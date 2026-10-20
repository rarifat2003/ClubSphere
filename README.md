# ClubSphere

## How to run

### 1. Download the project
```bash
git clone https://github.com/rarifat2003/ClubSphere.git
cd ClubSphere
```
### 2. Run the schema from MySQL workbench or Whatever RDBMS you use
Option 1 : Open workbench and select schema.sql then tap the lighting bolt icon 
#
Option 2 : Create the database. In the project folder, run:
```bash
mysql -u root -p < schema.sql
```
Enter your MySQL password when asked. If PowerShell rejects the <, use this instead:
```bash
mysql -u root -p -e "source schema.sql"
```
### 3. Install packages
Open a terminal in the project folder (VS Code terminal works) and run:
```bash
npm install
```

### 4. Change the database password
Open `db.js` and set the password to the one you use for your localhost MySQL `root` login.

### 5. Run the server ( Terminal )
```bash
nodemon server.js
```
