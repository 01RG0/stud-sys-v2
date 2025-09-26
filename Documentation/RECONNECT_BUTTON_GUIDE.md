# Reconnect Button Location Guide

## 📍 **Where to Find the Reconnect Button**

### **Admin Dashboard**
The reconnect button is located at the **bottom of the page** as a permanent bar.

**What you should see:**
- A **fixed bottom bar** with gradient background
- **Connection status** on the left (shows "Connected", "Disconnected", or "Connecting")
- **Two buttons** on the right:
  - 🔄 **Reconnect** button (green)
  - 🔄 **Refresh** button (gray)

### **Visual Description:**
```
┌─────────────────────────────────────────────────────────┐
│  📱 Connection Status: Connected    [Reconnect] [Refresh] │
└─────────────────────────────────────────────────────────┘
```

### **Button Colors:**
- 🟢 **Connected**: Green status with "Connected to server"
- 🔴 **Disconnected**: Red status with "Disconnected from server"
- 🟡 **Connecting**: Yellow status with pulsing animation

### **How to Use:**
1. **Reconnect Button**: Manually reconnect to the server
2. **Refresh Button**: Reload the entire page

### **If You Don't See It:**
1. **Check if the page is fully loaded**
2. **Scroll to the bottom** - it's a fixed bar
3. **Try refreshing the page** (F5)
4. **Check browser console** for any CSS errors

### **Alternative Access:**
If the permanent bar isn't visible, there's also a **popup overlay** that appears when connection is lost:
- Shows a modal dialog with reconnect options
- Appears automatically when connection fails
- Can be triggered manually if needed

### **All Pages Have It:**
- ✅ **Admin Dashboard**: `https://192.168.130.52:3443/admin-dashboard`
- ✅ **Entry Scanner**: `https://192.168.130.52:3443/entry-scanner`
- ✅ **Exit Validator**: `https://192.168.130.52:3443/exit-validator`

---

**Note**: The reconnect button should be **always visible** at the bottom of each page, regardless of connection status.
