# 🔄 HYBRID SYSTEM GUIDE
## Student Lab System - Local + MySQL Backup

### 🎯 **SYSTEM OVERVIEW**

The Hybrid System ensures **ZERO DATA LOSS** by combining:
- **Local Storage**: Immediate offline functionality
- **MySQL Backup**: Centralized data backup and sync
- **Auto-Sync**: Automatic synchronization when online
- **Conflict Resolution**: Smart handling of data conflicts

### 🚀 **KEY FEATURES**

#### ✅ **Entry Scanner**
- Local student cache with MySQL backup
- Offline QR scanning and manual entry
- Auto-sync queue for registrations
- Device login persistence
- Manual sync button

#### ✅ **Exit Validator**
- Local validation storage with MySQL backup
- Offline QR validation
- Auto-sync queue for validations
- Manual sync button

#### ✅ **Server APIs**
- `/api/sync` - Main sync endpoint
- `/api/sync/bulk` - Bulk sync operations
- `/api/sync/resolve-conflicts` - Conflict resolution
- `/api/sync/status` - Sync status monitoring

### 🔧 **TECHNICAL IMPLEMENTATION**

#### **Local Storage Keys**
```
entryScannerSyncQueue - Sync queue for Entry Scanner
entryScannerSyncStatus - Sync status and timestamps
exitValidatorSyncQueue - Sync queue for Exit Validator
exitValidatorSyncStatus - Sync status and timestamps
```

#### **Sync Operations**
- `create_student` - Add/update student data
- `create_registration` - Add entry registration
- `create_validation` - Add exit validation

#### **Conflict Resolution**
- `local` - Local data takes priority
- `server` - Server data takes priority
- `merge` - Merge both datasets

### 📊 **SYNC STATUS INDICATORS**

#### **Connection Status**
- 🟢 **Connected & Synced** - All data synchronized
- 🟡 **Connected (X pending sync)** - Data queued for sync
- 🔴 **Offline (X local, Y queued)** - Working offline

#### **Sync Status**
- 🟢 **Sync: Up to date** - All data synchronized
- 🟡 **Sync: X pending** - Items waiting to sync
- 🔴 **Sync: Offline (X queued)** - Offline mode active

### 🧪 **TESTING**

Run comprehensive tests:
```bash
TEST_HYBRID_SYSTEM.bat
```

Tests include:
- Server connection
- MySQL sync APIs
- Bulk sync operations
- Conflict resolution
- WebSocket connections
- All endpoint functionality

### 🛠️ **TROUBLESHOOTING**

#### **Sync Issues**
1. Check server connection
2. Verify MySQL database
3. Check sync queue status
4. Use manual sync button

#### **Data Conflicts**
1. Review conflict resolution strategy
2. Check local vs server data
3. Use conflict resolution API

#### **Offline Mode**
1. Verify local storage
2. Check sync queue
3. Monitor connection status

### 📈 **MONITORING**

#### **Data Integrity Counters**
- `localRecords` - Total local records
- `syncedRecords` - Successfully synced records
- `pendingSync` - Items in sync queue
- `lastBackup` - Last successful sync timestamp

#### **Auto-Sync**
- Runs every 2 minutes
- Processes sync queue automatically
- Retries failed operations (max 3 attempts)

### 🔒 **SECURITY**

- Local data encrypted in localStorage
- MySQL connection secured
- Conflict resolution prevents data loss
- Audit trail for all operations

### 📱 **USER INTERFACE**

#### **Sync Controls**
- Manual sync button
- Sync status indicator
- Connection status display
- Offline mode notifications

#### **Visual Feedback**
- Real-time sync status
- Pending sync counts
- Success/error notifications
- Progress indicators

---

**🎉 The Hybrid System ensures your data is always safe and accessible!**
