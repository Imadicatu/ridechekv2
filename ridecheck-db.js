// ============================================================
// RideCheck Database Layer — Firestore + localStorage Fallback
// ============================================================
// Unified API: เรียกใช้ RideCheckDB.xxx() ได้เลย
// ถ้า Firebase พร้อม → ใช้ Firestore
// ถ้า Firebase ยังไม่ตั้งค่า → Fallback ไปใช้ localStorage เหมือนเดิม
// ============================================================

const RideCheckDB = {

    // ===== HELPERS =====
    _generateSessionId() {
        let sid = sessionStorage.getItem('ridecheck_session_id');
        if (!sid) {
            sid = 'ses_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
            sessionStorage.setItem('ridecheck_session_id', sid);
        }
        return sid;
    },

    _now() {
        return FIREBASE_READY 
            ? firebase.firestore.FieldValue.serverTimestamp() 
            : new Date().toISOString();
    },

    // ===== 1. PLATFORM STATS (ยอดประหยัดสะสม, จำนวนผู้ใช้) =====
    async getPlatformStats() {
        if (FIREBASE_READY) {
            try {
                const doc = await firestoreDB.collection('platform_stats').doc('global').get();
                if (doc.exists) return doc.data();
            } catch (e) { console.warn('Firestore getPlatformStats error:', e); }
        }
        // Fallback to localStorage — Clean up any legacy dummy stat
        let saved = parseInt(localStorage.getItem('ridecheck_total_saved') || '0');
        if (saved >= 1000000) {
            saved = 0;
            localStorage.setItem('ridecheck_total_saved', '0');
        }
        let searches = parseInt(localStorage.getItem('ridecheck_total_searches') || '0');
        let conversions = parseInt(localStorage.getItem('ridecheck_total_conversions') || '0');

        return {
            totalSavings: saved,
            totalSearches: searches,
            totalConversions: conversions,
            avgSavingsPerTrip: conversions > 0 ? +(saved / conversions).toFixed(1) : 0,
            avgSavingsPercent: 25.0
        };
    },

    async updatePlatformStats(deltaFields) {
        if (FIREBASE_READY) {
            try {
                const ref = firestoreDB.collection('platform_stats').doc('global');
                const updates = { lastUpdated: this._now() };
                for (const [key, val] of Object.entries(deltaFields)) {
                    updates[key] = firebase.firestore.FieldValue.increment(val);
                }
                await ref.set(updates, { merge: true });
                return true;
            } catch (e) { console.warn('Firestore updatePlatformStats error:', e); }
        }
        // Fallback
        for (const [key, val] of Object.entries(deltaFields)) {
            const lsKey = key === 'totalSavings' ? 'ridecheck_total_saved' 
                        : key === 'totalSearches' ? 'ridecheck_total_searches'
                        : key === 'totalConversions' ? 'ridecheck_total_conversions' : null;
            if (lsKey) {
                const current = parseInt(localStorage.getItem(lsKey) || '0');
                localStorage.setItem(lsKey, (current + val).toString());
            }
        }
        return true;
    },

    listenPlatformStats(callback) {
        if (FIREBASE_READY) {
            return firestoreDB.collection('platform_stats').doc('global')
                .onSnapshot(doc => {
                    if (doc.exists) callback(doc.data());
                }, err => console.warn('listenPlatformStats error:', err));
        }
        // Fallback: poll localStorage every 3 seconds
        const interval = setInterval(async () => {
            callback(await this.getPlatformStats());
        }, 3000);
        return () => clearInterval(interval);
    },

    // ===== 2. SEARCHES (บันทึกการค้นหาเส้นทาง) =====
    async recordSearch(searchData) {
        const record = {
            pickup: searchData.pickup || '',
            pickupLat: searchData.pickupCoords?.[0] || 0,
            pickupLng: searchData.pickupCoords?.[1] || 0,
            dropoff: searchData.dropoff || '',
            dropoffLat: searchData.dropoffCoords?.[0] || 0,
            dropoffLng: searchData.dropoffCoords?.[1] || 0,
            distanceKm: searchData.distance || 0,
            durationMin: searchData.duration || 0,
            vehicleType: searchData.vehicleType || 'bike',
            surge: searchData.surge || 1.0,
            cheapestApp: searchData.cheapestApp || '',
            cheapestPrice: searchData.cheapestPrice || 0,
            results: searchData.results || [],
            sessionId: this._generateSessionId(),
            timestamp: this._now()
        };

        if (FIREBASE_READY) {
            try {
                const docRef = await firestoreDB.collection('searches').add(record);
                // Also increment totalSearches
                await this.updatePlatformStats({ totalSearches: 1 });
                return docRef.id;
            } catch (e) { console.warn('Firestore recordSearch error:', e); }
        }
        // Fallback
        const searches = JSON.parse(localStorage.getItem('ridecheck_searches') || '[]');
        record.id = 'ls_' + Date.now();
        searches.push(record);
        if (searches.length > 500) searches.splice(0, searches.length - 500); // Keep last 500
        localStorage.setItem('ridecheck_searches', JSON.stringify(searches));
        return record.id;
    },

    listenRecentSearches(callback, limitCount = 20) {
        if (FIREBASE_READY) {
            return firestoreDB.collection('searches')
                .orderBy('timestamp', 'desc')
                .limit(limitCount)
                .onSnapshot(snapshot => {
                    const searches = [];
                    snapshot.forEach(doc => searches.push({ id: doc.id, ...doc.data() }));
                    callback(searches);
                }, err => console.warn('listenRecentSearches error:', err));
        }
        // Fallback
        const interval = setInterval(() => {
            const searches = JSON.parse(localStorage.getItem('ridecheck_searches') || '[]');
            callback(searches.slice(-limitCount).reverse());
        }, 5000);
        return () => clearInterval(interval);
    },

    // ===== 3. CONVERSIONS (กดเรียกรถจริงผ่าน Deep Link) =====
    async recordConversion(conversionData) {
        // Deduplication: check if same route was clicked within 15 minutes
        const dedupKey = `dedup_${conversionData.pickup}_${conversionData.dropoff}_${conversionData.appChosen}`;
        const lastClick = sessionStorage.getItem(dedupKey);
        if (lastClick && (Date.now() - parseInt(lastClick)) < 15 * 60 * 1000) {
            console.log('[RideCheck] Dedup: Same route clicked within 15 min, skipping conversion');
            return null;
        }
        sessionStorage.setItem(dedupKey, Date.now().toString());

        const record = {
            appChosen: conversionData.appChosen || '',
            priceChosen: conversionData.priceChosen || 0,
            baselinePrice: conversionData.baselinePrice || 0,
            savings: conversionData.savings || 0,
            vehicleType: conversionData.vehicleType || 'bike',
            pickup: conversionData.pickup || '',
            dropoff: conversionData.dropoff || '',
            route: `${conversionData.pickup} → ${conversionData.dropoff}`,
            sessionId: this._generateSessionId(),
            timestamp: this._now()
        };

        if (FIREBASE_READY) {
            try {
                const docRef = await firestoreDB.collection('conversions').add(record);
                // Update platform stats
                const statsDelta = { totalConversions: 1 };
                if (record.savings > 0) {
                    statsDelta.totalSavings = record.savings;
                }
                await this.updatePlatformStats(statsDelta);
                return docRef.id;
            } catch (e) { console.warn('Firestore recordConversion error:', e); }
        }
        // Fallback
        if (record.savings > 0) {
            let saved = parseInt(localStorage.getItem('ridecheck_total_saved') || '0');
            if (saved >= 1000000) saved = 0;
            saved += record.savings;
            localStorage.setItem('ridecheck_total_saved', saved.toString());
        }
        const conversions = JSON.parse(localStorage.getItem('ridecheck_conversions') || '[]');
        record.id = 'ls_' + Date.now();
        conversions.push(record);
        if (conversions.length > 500) conversions.splice(0, conversions.length - 500);
        localStorage.setItem('ridecheck_conversions', JSON.stringify(conversions));
        return record.id;
    },

    listenRecentConversions(callback, limitCount = 20) {
        if (FIREBASE_READY) {
            return firestoreDB.collection('conversions')
                .orderBy('timestamp', 'desc')
                .limit(limitCount)
                .onSnapshot(snapshot => {
                    const conversions = [];
                    snapshot.forEach(doc => conversions.push({ id: doc.id, ...doc.data() }));
                    callback(conversions);
                }, err => console.warn('listenRecentConversions error:', err));
        }
        const interval = setInterval(() => {
            const conversions = JSON.parse(localStorage.getItem('ridecheck_conversions') || '[]');
            callback(conversions.slice(-limitCount).reverse());
        }, 5000);
        return () => clearInterval(interval);
    },

    // ===== 4. AGENTS (ข้อมูล Agent พนักงาน — sync กับ Office) =====
    async getAgent(agentId) {
        if (FIREBASE_READY) {
            try {
                const doc = await firestoreDB.collection('agents').doc(agentId).get();
                if (doc.exists) return { id: doc.id, ...doc.data() };
            } catch (e) { console.warn('Firestore getAgent error:', e); }
        }
        // Fallback
        const skills = JSON.parse(localStorage.getItem('ridecheck_employee_skills') || '{}');
        return skills.agents?.[agentId] || null;
    },

    async updateAgent(agentId, data) {
        if (FIREBASE_READY) {
            try {
                await firestoreDB.collection('agents').doc(agentId).set({
                    ...data,
                    lastActive: this._now()
                }, { merge: true });
                return true;
            } catch (e) { console.warn('Firestore updateAgent error:', e); }
        }
        // Fallback
        const skills = JSON.parse(localStorage.getItem('ridecheck_employee_skills') || '{}');
        if (!skills.agents) skills.agents = {};
        skills.agents[agentId] = { ...(skills.agents[agentId] || {}), ...data };
        localStorage.setItem('ridecheck_employee_skills', JSON.stringify(skills));
        return true;
    },

    async getAllAgents() {
        if (FIREBASE_READY) {
            try {
                const snapshot = await firestoreDB.collection('agents').get();
                const agents = {};
                snapshot.forEach(doc => { agents[doc.id] = doc.data(); });
                return agents;
            } catch (e) { console.warn('Firestore getAllAgents error:', e); }
        }
        const skills = JSON.parse(localStorage.getItem('ridecheck_employee_skills') || '{}');
        return skills.agents || {};
    },

    listenAgents(callback) {
        if (FIREBASE_READY) {
            return firestoreDB.collection('agents')
                .onSnapshot(snapshot => {
                    const agents = {};
                    snapshot.forEach(doc => { agents[doc.id] = { id: doc.id, ...doc.data() }; });
                    callback(agents);

                    // Log changes for office HUD
                    snapshot.docChanges().forEach(change => {
                        if (change.type === 'modified') {
                            const d = change.doc.data();
                            console.log(`[AgentSync] ${d.name || change.doc.id} status → ${d.status}`);
                        }
                    });
                }, err => console.warn('listenAgents error:', err));
        }
        const interval = setInterval(async () => {
            callback(await this.getAllAgents());
        }, 4000);
        return () => clearInterval(interval);
    },

    // ===== 5. AGENT MESSAGES (ข้อความสนทนา) =====
    async sendAgentMessage(agentId, text, direction = 'outgoing', from = 'ท่าน Siridetxh') {
        const msg = {
            agentId,
            direction,
            text,
            from,
            read: false,
            timestamp: this._now()
        };

        if (FIREBASE_READY) {
            try {
                return (await firestoreDB.collection('agent_messages').add(msg)).id;
            } catch (e) { console.warn('Firestore sendAgentMessage error:', e); }
        }
        // Fallback — stored in memory only for current session
        const msgs = JSON.parse(sessionStorage.getItem(`agent_msgs_${agentId}`) || '[]');
        msg.id = 'ls_' + Date.now();
        msgs.push(msg);
        sessionStorage.setItem(`agent_msgs_${agentId}`, JSON.stringify(msgs));
        return msg.id;
    },

    listenAgentMessages(agentId, callback, limitCount = 50) {
        if (FIREBASE_READY) {
            return firestoreDB.collection('agent_messages')
                .where('agentId', '==', agentId)
                .orderBy('timestamp', 'desc')
                .limit(limitCount)
                .onSnapshot(snapshot => {
                    const msgs = [];
                    snapshot.forEach(doc => msgs.push({ id: doc.id, ...doc.data() }));
                    callback(msgs.reverse()); // Oldest first
                }, err => console.warn('listenAgentMessages error:', err));
        }
        const interval = setInterval(() => {
            const msgs = JSON.parse(sessionStorage.getItem(`agent_msgs_${agentId}`) || '[]');
            callback(msgs.slice(-limitCount));
        }, 3000);
        return () => clearInterval(interval);
    },

    // ===== 6. EXECUTIVE INBOX (กล่องข้อความผู้บริหาร) =====
    async addToInbox(item) {
        const record = {
            from: item.from || 'System',
            subject: item.subject || '',
            body: item.body || '',
            status: item.status || 'pending',
            priority: item.priority || 'normal',
            timestamp: this._now(),
            attachments: item.attachments || []
        };

        if (FIREBASE_READY) {
            try {
                return (await firestoreDB.collection('executive_inbox').add(record)).id;
            } catch (e) { console.warn('Firestore addToInbox error:', e); }
        }
        const inbox = JSON.parse(localStorage.getItem('baron_executive_inbox') || '[]');
        record.id = 'ls_' + Date.now();
        inbox.push(record);
        localStorage.setItem('baron_executive_inbox', JSON.stringify(inbox));
        return record.id;
    },

    async updateInboxItem(itemId, updates) {
        if (FIREBASE_READY) {
            try {
                await firestoreDB.collection('executive_inbox').doc(itemId).update(updates);
                return true;
            } catch (e) { console.warn('Firestore updateInboxItem error:', e); }
        }
        const inbox = JSON.parse(localStorage.getItem('baron_executive_inbox') || '[]');
        const idx = inbox.findIndex(i => i.id === itemId);
        if (idx >= 0) {
            Object.assign(inbox[idx], updates);
            localStorage.setItem('baron_executive_inbox', JSON.stringify(inbox));
        }
        return true;
    },

    listenInbox(callback) {
        if (FIREBASE_READY) {
            return firestoreDB.collection('executive_inbox')
                .orderBy('timestamp', 'desc')
                .limit(50)
                .onSnapshot(snapshot => {
                    const items = [];
                    snapshot.forEach(doc => items.push({ id: doc.id, ...doc.data() }));
                    callback(items);
                }, err => console.warn('listenInbox error:', err));
        }
        const interval = setInterval(() => {
            const inbox = JSON.parse(localStorage.getItem('baron_executive_inbox') || '[]');
            callback(inbox.reverse());
        }, 4000);
        return () => clearInterval(interval);
    },

    // ===== 7. MEETINGS (ประวัติการประชุมทีม) =====
    async saveMeeting(meetingData) {
        const record = {
            title: meetingData.title || 'Team Meeting',
            participants: meetingData.participants || [],
            messages: meetingData.messages || [],
            durationMin: meetingData.durationMin || 0,
            timestamp: this._now()
        };

        if (FIREBASE_READY) {
            try {
                return (await firestoreDB.collection('meetings').add(record)).id;
            } catch (e) { console.warn('Firestore saveMeeting error:', e); }
        }
        const meetings = JSON.parse(localStorage.getItem('baron_meeting_history') || '[]');
        record.id = 'ls_' + Date.now();
        meetings.push(record);
        localStorage.setItem('baron_meeting_history', JSON.stringify(meetings));
        return record.id;
    },

    listenMeetings(callback, limitCount = 20) {
        if (FIREBASE_READY) {
            return firestoreDB.collection('meetings')
                .orderBy('timestamp', 'desc')
                .limit(limitCount)
                .onSnapshot(snapshot => {
                    const meetings = [];
                    snapshot.forEach(doc => meetings.push({ id: doc.id, ...doc.data() }));
                    callback(meetings);
                }, err => console.warn('listenMeetings error:', err));
        }
        const interval = setInterval(() => {
            const meetings = JSON.parse(localStorage.getItem('baron_meeting_history') || '[]');
            callback(meetings.slice(-limitCount).reverse());
        }, 5000);
        return () => clearInterval(interval);
    },

    // ===== 8. DELIVERED WORKS (ผลงานที่ Agent ส่งมอบ) =====
    async addDeliveredWork(work) {
        const record = {
            from: work.from || 'Agent',
            title: work.title || '',
            description: work.description || '',
            fileUrl: work.fileUrl || '',
            status: work.status || 'delivered',
            timestamp: this._now()
        };

        if (FIREBASE_READY) {
            try {
                return (await firestoreDB.collection('delivered_works').add(record)).id;
            } catch (e) { console.warn('Firestore addDeliveredWork error:', e); }
        }
        const works = JSON.parse(localStorage.getItem('baron_delivered_works') || '[]');
        record.id = 'ls_' + Date.now();
        works.push(record);
        localStorage.setItem('baron_delivered_works', JSON.stringify(works));
        return record.id;
    },

    listenDeliveredWorks(callback) {
        if (FIREBASE_READY) {
            return firestoreDB.collection('delivered_works')
                .orderBy('timestamp', 'desc')
                .limit(30)
                .onSnapshot(snapshot => {
                    const works = [];
                    snapshot.forEach(doc => works.push({ id: doc.id, ...doc.data() }));
                    callback(works);
                }, err => console.warn('listenDeliveredWorks error:', err));
        }
        const interval = setInterval(() => {
            const works = JSON.parse(localStorage.getItem('baron_delivered_works') || '[]');
            callback(works.reverse());
        }, 5000);
        return () => clearInterval(interval);
    },

    // ===== 9. HQ SYNC BROADCAST (Office ↔ ทุกหน้า) =====
    async broadcastHQSync(actionTitle, author, extraData = {}) {
        const payload = {
            action: actionTitle,
            author: author || 'ท่าน Siridetxh & คุณบารอน',
            data: extraData,
            timestamp: this._now()
        };

        if (FIREBASE_READY) {
            try {
                // Write to a special "live_events" collection
                await firestoreDB.collection('live_events').add(payload);
                return true;
            } catch (e) { console.warn('Firestore broadcastHQSync error:', e); }
        }
        // Fallback: localStorage broadcast
        localStorage.setItem('ridecheck_hq_sync', JSON.stringify({
            ...payload,
            timestamp: Date.now()
        }));
        return true;
    },

    listenHQSync(callback) {
        if (FIREBASE_READY) {
            // Listen to events from the last 60 seconds only
            const cutoff = new Date(Date.now() - 60000);
            return firestoreDB.collection('live_events')
                .where('timestamp', '>', cutoff)
                .orderBy('timestamp', 'desc')
                .limit(5)
                .onSnapshot(snapshot => {
                    snapshot.docChanges().forEach(change => {
                        if (change.type === 'added') {
                            callback(change.doc.data());
                        }
                    });
                }, err => console.warn('listenHQSync error:', err));
        }
        // Fallback: listen to localStorage changes
        const handler = (e) => {
            if (e.key === 'ridecheck_hq_sync' && e.newValue) {
                try { callback(JSON.parse(e.newValue)); } catch (err) {}
            }
        };
        window.addEventListener('storage', handler);
        return () => window.removeEventListener('storage', handler);
    },

    // ===== 10. MIGRATION: localStorage → Firestore =====
    async migrateFromLocalStorage() {
        if (!FIREBASE_READY) {
            console.warn('[Migration] Firebase ยังไม่พร้อม ไม่สามารถ migrate ได้');
            return false;
        }

        console.log('[Migration] 🔄 เริ่มย้ายข้อมูลจาก localStorage → Firestore...');
        const batch = firestoreDB.batch();
        let migrated = 0;

        // 1. Platform Stats
        let totalSaved = parseInt(localStorage.getItem('ridecheck_total_saved') || '0');
        if (totalSaved >= 1000000) totalSaved = 0;
        let totalSearches = parseInt(localStorage.getItem('ridecheck_total_searches') || '0');
        let totalConversions = parseInt(localStorage.getItem('ridecheck_total_conversions') || '0');
        const statsRef = firestoreDB.collection('platform_stats').doc('global');
        batch.set(statsRef, {
            totalSavings: totalSaved,
            totalSearches: totalSearches,
            totalConversions: totalConversions,
            avgSavingsPerTrip: totalConversions > 0 ? +(totalSaved / totalConversions).toFixed(1) : 0,
            avgSavingsPercent: 25.0,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
            migratedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        migrated++;

        // 2. Employee Skills → Agents
        const skills = JSON.parse(localStorage.getItem('ridecheck_employee_skills') || '{}');
        if (skills.agents) {
            for (const [agentId, agentData] of Object.entries(skills.agents)) {
                const agentRef = firestoreDB.collection('agents').doc(agentId);
                batch.set(agentRef, {
                    ...agentData,
                    migratedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    lastActive: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
                migrated++;
            }
        }

        // 3. Staff Names
        const savedNames = JSON.parse(localStorage.getItem('baron_staff_names') || '{}');
        for (const [agentId, name] of Object.entries(savedNames)) {
            const agentRef = firestoreDB.collection('agents').doc(agentId);
            batch.set(agentRef, { customName: name }, { merge: true });
        }

        // 4. Executive Inbox
        const inbox = JSON.parse(localStorage.getItem('baron_executive_inbox') || '[]');
        for (const item of inbox.slice(-30)) { // Last 30 items
            const ref = firestoreDB.collection('executive_inbox').doc();
            batch.set(ref, {
                ...item,
                timestamp: item.timestamp || firebase.firestore.FieldValue.serverTimestamp(),
                migratedFromLS: true
            });
            migrated++;
        }

        // 5. Meeting History
        const meetings = JSON.parse(localStorage.getItem('baron_meeting_history') || '[]');
        for (const meeting of meetings.slice(-20)) {
            const ref = firestoreDB.collection('meetings').doc();
            batch.set(ref, {
                ...meeting,
                timestamp: meeting.timestamp || firebase.firestore.FieldValue.serverTimestamp(),
                migratedFromLS: true
            });
            migrated++;
        }

        // 6. Delivered Works
        const works = JSON.parse(localStorage.getItem('baron_delivered_works') || '[]');
        for (const work of works.slice(-20)) {
            const ref = firestoreDB.collection('delivered_works').doc();
            batch.set(ref, {
                ...work,
                timestamp: work.timestamp || firebase.firestore.FieldValue.serverTimestamp(),
                migratedFromLS: true
            });
            migrated++;
        }

        try {
            await batch.commit();
            console.log(`[Migration] ✅ ย้ายข้อมูลสำเร็จ! ${migrated} รายการถูกบันทึกลง Firestore`);
            
            // Mark migration as done
            localStorage.setItem('ridecheck_firestore_migrated', 'true');
            return true;
        } catch (err) {
            console.error('[Migration] ❌ ย้ายข้อมูลล้มเหลว:', err);
            return false;
        }
    },

    // Check if migration is needed
    shouldMigrate() {
        return FIREBASE_READY && localStorage.getItem('ridecheck_firestore_migrated') !== 'true';
    },

    // Auto-migrate on first load
    async autoMigrate() {
        if (this.shouldMigrate()) {
            console.log('[Migration] 📦 ตรวจพบข้อมูล localStorage ที่ยังไม่ได้ย้าย — เริ่ม Migration อัตโนมัติ...');
            return await this.migrateFromLocalStorage();
        }
        return false;
    },

    // ===== 9. PLATFORM SETTINGS & AUTONOMOUS BOT LISTENERS =====
    listenPlatformSettings(docName, callback) {
        if (FIREBASE_READY) {
            return firestoreDB.collection('platform_settings').doc(docName)
                .onSnapshot(doc => {
                    if (doc.exists) callback(doc.data());
                }, err => console.warn(`listenPlatformSettings(${docName}) error:`, err));
        }
        // Fallback: poll project-resources.json every 5 seconds
        const interval = setInterval(async () => {
            try {
                const res = await fetch('project-resources.json?t=' + Date.now());
                if (res.ok) {
                    const data = await res.json();
                    if (docName === 'pricing') {
                        callback({
                            activeSurgeMultiplier: data.departments?.data?.activeSurgeMultiplier || 1.0,
                            surgeReason: data.departments?.data?.surgeReason || 'Automatic AI Calculation',
                            weather: data.departments?.data?.weather || {}
                        });
                    } else if (docName === 'system_health') {
                        callback({
                            status: data.departments?.dev?.systemStatus?.health || 'PERFECT_HEALTH',
                            latencies: data.departments?.dev?.systemStatus?.latencies || {}
                        });
                    }
                }
            } catch(e) {}
        }, 5000);
        return () => clearInterval(interval);
    },

    listenCompletedTasks(callback, limitCount = 15) {
        if (FIREBASE_READY) {
            return firestoreDB.collection('completed_tasks')
                .orderBy('timestamp', 'desc')
                .limit(limitCount)
                .onSnapshot(snapshot => {
                    const tasks = [];
                    snapshot.forEach(doc => tasks.push({ id: doc.id, ...doc.data() }));
                    callback(tasks);
                }, err => console.warn('listenCompletedTasks error:', err));
        }
        // Fallback: read local logs if available
        const interval = setInterval(async () => {
            try {
                const res = await fetch('logs/completed_tasks.json?t=' + Date.now());
                if (res.ok) {
                    const tasks = await res.json();
                    callback(tasks.slice(-limitCount).reverse());
                }
            } catch(e) {}
        }, 5000);
        return () => clearInterval(interval);
    },

    listenAgentLogs(callback, limitCount = 20) {
        if (FIREBASE_READY) {
            return firestoreDB.collection('agent_logs')
                .orderBy('timestamp', 'desc')
                .limit(limitCount)
                .onSnapshot(snapshot => {
                    const logs = [];
                    snapshot.forEach(doc => logs.push({ id: doc.id, ...doc.data() }));
                    callback(logs);
                }, err => console.warn('listenAgentLogs error:', err));
        }
        return () => {};
    },

    // ===== CONNECTION STATUS =====
    isFirebaseReady() {
        return FIREBASE_READY;
    },

    getConnectionStatus() {
        return {
            firebase: FIREBASE_READY,
            projectId: FIREBASE_READY ? firebaseConfig.projectId : null,
            mode: FIREBASE_READY ? 'Firestore (Real-time Cloud)' : 'localStorage (Offline Only)'
        };
    }
};

// Auto-run migration when the page loads
if (typeof window !== 'undefined') {
    window.addEventListener('load', () => {
        setTimeout(() => {
            RideCheckDB.autoMigrate();
        }, 2000); // Wait 2 seconds for Firebase to fully initialize
    });
}
