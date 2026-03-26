# 🛑 IMPORTANT: Fixing Data Loss in Coolify

It appears your database is **ephemeral**, meaning it resets to zero every time you redeploy the app. This is a common setup issue in Coolify where the database volume is not persistently mapped.

## 1. How to Fix Future Data Loss (Persistence)
To stop orders from being deleted during every deployment, you **must** do the following in your Coolify dashboard:

1.  Go to your **PostgreSQL Database** service in Coolify.
2.  Open the **Storage / Volumes** tab.
3.  Ensure there is a volume mapping like this:
    - **Source**: `pg-data` (or similar)
    - **Destination**: `/var/lib/postgresql/data`
4.  If this is missing, any data you save will stay only in RAM/Temp and vanish on restart. **Add this volume and restart the database.**

---

## 2. Can we Recover Orders?
I cannot see your old orders because they were in a different database instance that has likely been wiped. However:

**Option A: If you were on Railway recently**
If your old orders are still on Railway, you can recover them by:
1.  Getting your **Railway PostgreSQL URL**.
2.  Providing it to me.
3.  I will write a script to move the data from Railway to Coolify.

**Option B: If you have a JSON export**
If you ever used the "Export Orders" button in the Admin dashboard:
1.  Upload that JSON file here.
2.  I will import it into your current database.

---

## 3. Temporary "Safety Net" Script
I have created a script `scripts/auto_backup.js` in your project. I recommend running this manually (or adding it to your deployment flow) to save a local copy of your orders before every deployment.

To run a manual backup now:
```bash
node scripts/auto_backup.js
```
This will create a `backup/orders_backup_[date].json` file.

---

### 🚨 Action Required:
Please check your Coolify Database settings for **Persistent Storage**. If it is not set, **do not place more orders until it is fixed**, as they will be lost on the next update!
