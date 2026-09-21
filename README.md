# TechRaga '26 - College Fest Spot Registration & Event Gate Portal

An enterprise-grade, high-concurrency event spot registration, participant management, approval workflow, and gate entry verification system designed for **TechRaga '26** at **KPR College of Arts Science and Research**.

---

## 🌟 Key Features

1. **Spot Registration Kiosk (`#spot-registration`)**:
   - Single & Multi-Day pass selection (Day 1 ₹250, Day 2 ₹250, Both Days ₹350, Free Fire ₹400).
   - Dynamic event selection across 21 events (Day 1: 10 events, Day 2: 11 events).
   - Real-time pricing calculator, team validation, and instant receipt generation.

2. **Coordinator Portal (`#coordinator-portal`)**:
   - **Multi-Account Login**: Unified portal supporting all 21 event coordinators + Master coordinator.
   - **Smart Access Control**: Logging in as an event coordinator unlocks that specific desk while locking and restricting access to other desks.
   - **Team Formation Hub**: Interactive WhatsApp-style participant selection and team builder.
   - **Attendance & Food Token Verification**: Quick check-in and food coupon issuance tracking.

3. **Admin Master Portal (`#admin-master`)**:
   - **Master Participant Directory**: Search, multilevel filtering (Source: Online/Spot, Pass: Day1/Day2/Both), and Excel export.
   - **Approvals Desk**: Review & approve profile changes and event switch requests in real-time.
   - **Free Fire Hub**: Manage teams, solo players, and tournament roster.
   - **Counter Management & Analytics**: Track spot registration counters and real-time revenue KPIs.
   - **Access Control & Credentials Management**: Dynamic in-app username/password updates for all 21 events and 5 core portals.

4. **Event Issue Management (`#event-issue`)**:
   - Spot change requests, student profile updates, and audit logging.

5. **Day 2 Gate Search (`#day2-gate-search`)**:
   - Quick barcode/reg ID lookup for entry gate security and attendance validation.

---

## 🛠️ Tech Stack

- **Backend**: Python 3 (Flask, PyMySQL, DBUtils Connection Pooling)
- **Database**: MySQL (`event_spot_registration`) with high-concurrency connection pool
- **Frontend**: Responsive HTML5, Vanilla JavaScript (ES6+), CSS3 with modern custom scrollbars and SweetAlert2 notifications
- **Excel Engine**: OpenPyXL for multi-sheet reports and directory exports

---

## 🚀 Getting Started

### 1. Prerequisites
- Python 3.10+
- MySQL Server 8.0+

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/sathish24111/on-Spot.git
cd on-Spot

# Install Python dependencies
pip install -r requirements.txt
```

### 3. Database Configuration
Copy `.env.example` to `.env` and set your MySQL credentials:
```ini
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=event_spot_registration
DB_CONNECTION_LIMIT=30
```

### 4. Run the Server
```bash
python app.py
```
The application will run at **http://localhost:3000**.

---

## 🔑 Default Credentials Reference

| Module / Event Desk | Username | Default Password | Access Level |
| :--- | :--- | :--- | :--- |
| **Admin Master** | `admin` | `admin123` | Universal Full Access |
| **Coordinator Master** | `coordinator` | `coord123` | All 21 Events Unlocked |
| **Spot Registration** | `spot` | `spot123` | Registration Kiosk |
| **Event Issue Desk** | `issue` | `issue1234` | Issue & Modification Desk |
| **Day 2 Gate Search** | `gate` | `gate123` | Gate Verification |
| **Adzap** | `adzap` | `adzap123` | Adzap Desk Only |
| **Hackathon** | `hackathon` | `hack123` | Hackathon Desk Only |
| **Free Fire** | `freefire` | `ff123` | Free Fire Desk Only |
| *(All other 18 events)* | *(event username)* | *(event password)* | *(Respective Event Only)* |
