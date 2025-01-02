const axios = require("axios");
const { log, time } = require("console");
const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");
const yaml = require('js-yaml');
const path = require("path");

// Configuration
const CONFIG_PATH = "/data/options.json"; // Default add-on configuration path
const DB_PATH = "/data/tesla_cpo.db";
const IP_ADDRESS = process.env.HASSIO_IP_ADDRESS || "localhost";

const URL = 'https://www.tesla.com/inventory/api/v4/inventory-results';
const teslaV4ApiQuery = {
  "query": {
    "model": "m3",
    "condition": "used",
    "options": {
      "TRIM": [
        "PAWD",
        "LRAWD"
      ]
    },
    "arrangeby": "Price",
    "order": "asc",
    "market": "NL",
    "language": "nl",
    "super_region": "north america",
    "lng": 5.3849,
    "lat": 52.1592,
    "zip": "3811",
    "range": 0,
    "region": "NL"
  },
  "offset": 0,
  "count": 100,
  "outsideOffset": 0,
  "outsideSearch": false,
  "isFalconDeliverySelectionEnabled": false,
  "version": null
};


// Send notification via Home Assistant
const sendNotification = async (notifyService, message) => {
  const supervisorToken = process.env.SUPERVISOR_TOKEN;
  const url = `http://${IP_ADDRESS}:8123/core/api/services/${notifyService}`;

  // @todo - set auth token or something

  try {
    await axios.post(
      url,
      { message },
      { headers: { Authorization: `Bearer ${supervisorToken}` } }
    );
  } catch (error) {
    logErrorMessage("sendNotification", `Error sending notification: ${error.message}`);
  }
};

const loadConfig = () => {
  if (!fs.existsSync(CONFIG_PATH)) {
    logErrorMessage("main", "Configuration file not found.");
  }

  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));

  logMessage("main", "Configuration loaded with values: " + JSON.stringify(config) + "\n");
  return config;
};

// Initialize SQLite database
const initDb = () => {
  logMessage("main", "Database initializing at path: " + DB_PATH);
  const db = new sqlite3.Database(DB_PATH);
  db.serialize(() => {
    db.run(
      `CREATE TABLE IF NOT EXISTS vehicle (
        vin TEXT PRIMARY KEY,
        price INTEGER,
        last_updated TIMESTAMP
      )`
    );
  });
  return db;
};

// Fetch Tesla CPO data
const fetchCpoData = async (config) => {
  const composedURL = URL + '?query=' + JSON.stringify(teslaV4ApiQuery);
  try {
    const response = await axios.get(composedURL, { headers: {'User-Agent':'Mozilla/5.0'}, timeout: 5000 });
    const inventory = response.data.results;

    if (config.vins.length === 0) {
      logErrorMessage("fetchCpoData", "No VINs to monitor.");
      return [];
    }

    const vehicles = inventory.map((veh) => {
      if (config.vins.includes(veh.VIN)) {
        return {
          VIN: veh.VIN,
          price: veh.TotalPrice,
        };
      }
    }).filter(Boolean); // Remove undefined entries

    logMessage("fetchCpoData", `Fetched ${vehicles.length} matching vehicles from Tesla CPO API.`);
    logMessage("fetchCpoData", `Matched Vehicles: ${JSON.stringify(vehicles)}`);

    return vehicles;
  } catch (error) {
    logErrorMessage("fetchCpoData", `Something went wrong: ${error.message}, #error: ${error}`);
    return [];
  }
};

// Monitor VIN
const monitorVins = (config, db) => {
  const { vins, interval, notify_service: notifyService } = config;

  if (!vins || !interval || !notifyService) {
    logErrorMessage("monitorVins", "Configuration is missing required fields.");
    return;
  }

  setInterval(async () => {
    const vehicles = await fetchCpoData(config);

    console.log("Vehicles at setInterval(): " + JSON.stringify(vehicles));

    // Process each vehicle
    vehicles.forEach(({ VIN, price }) => {
      db.get("SELECT price FROM vehicle WHERE vin = ?", [VIN], (err, row) => {
        if (err) {
          logErrorMessage("monitorVins", `Database error for VIN ${VIN} (line 124): ${err.message}`);
          return;
        }

        if (row) {
          const lastPrice = row.price;
          if (price !== lastPrice) {
            sendNotification(
              notifyService,
              `Tesla VIN ${VIN}: Price changed from $${lastPrice} to $${price}.`
            );
            db.run(
              "UPDATE vehicle SET price = ?, last_updated = ? WHERE vin = ?",
              [price, new Date().toISOString(), VIN]
            );
          }
        } else {
          db.run(
            "INSERT INTO vehicle (vin, price, last_updated) VALUES (?, ?, ?)",
            [VIN, price, new Date().toISOString()]
          );
        }
      });
    });

    // Check for VINs no longer in the inventory
    const returnedVINs = vehicles.map((v) => v.VIN);
    vins.forEach((VIN) => {
      if (!returnedVINs.includes(VIN)) {
        db.get("SELECT price FROM vehicle WHERE vin = ?", [VIN], (err, row) => {
          if (err) {
            logErrorMessage("monitorVins", `Database error for VIN ${VIN} (line 155): ${err.message}`);
            return;
          }

          if (row) {
            db.run("DELETE FROM vehicle WHERE vin = ?", [VIN]);
            sendNotification(
              notifyService,
              `Tesla VIN ${VIN} is no longer available.`
            );
          }
        });
      }
    });
  }, interval * 60 * 1000);
};

const logMessage = (functionName, message) => {
  const currentTime = new Date().toISOString(); // Get the current time in ISO format
  console.log(`[${currentTime}] [${functionName}] ${message}`);
};

const logErrorMessage = (functionName, message) => {
  const currentTime = new Date().toISOString(); // Get the current time in ISO format
  console.error(`[${currentTime}] [${functionName}] - ERROR - ${message}`);
};

// Main function
const main = () => {
  const config = loadConfig();
  const db = initDb();

  monitorVins(config, db);
};

logMessage("main", "Starting Tesla CPO monitor...");

main();
