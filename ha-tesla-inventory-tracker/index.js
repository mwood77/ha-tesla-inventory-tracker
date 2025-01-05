const axios = require("axios");
const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");
const yaml = require('js-yaml');
const path = require("path");

const CONFIG_PATH = "/data/options.json"; // Default add-on configuration path
const DB_PATH = "/data/tesla_cpo.db";
let globalConfig = {};

const consoleColours = {
  cyan: '\x1b[36m%s\x1b[0m',
  red: '\x1b[31m%s\x1b[0m',
  green: '\x1b[32m%s\x1b[0m',
  yellow: '\x1b[33m%s\x1b[0m',
  magenta: '\x1b[35m%s\x1b[0m',
}

const URL = 'https://www.tesla.com/inventory/api/v4/inventory-results';

const composeUrlQuery = (model, market, language, postalCode, region) => {

  let queryParams = {
    "query": {
      "model": model,
      "condition": "used",
      "arrangeby": "Price",
      "order": "asc",
      "market": market.toUpperCase().trim(),
      "language": language.toLowerCase().trim(),
      "super_region": "north america",
      "zip": postalCode.trim(),
      "range": 0,
      "region": region.toUpperCase().trim(),
    },
    "offset": 0,
    "count": 100,
    "outsideOffset": 0,
    "outsideSearch": false,
    "isFalconDeliverySelectionEnabled": false,
    "version": null
  };
  
  return queryParams;
}

function getMappedModels(model) {

  const trimmedModel = model.toLowerCase().trim();
  let sanitizedUserInput;

  if (trimmedModel.includes(" ")) {
    sanitizedUserInput = trimmedModel.split(" ")[1];

    if (sanitizedUserInput === "truck") {
      sanitizedUserInput = "cybertruck";
    }
  }

  const MODEL_MAPPING = {
    "s": "ms",
    "3": "m3",
    "x": "mx",
    "y": "my",
    "cybertruck": "ct"
  };

  return MODEL_MAPPING[sanitizedUserInput];
};

const composeTeslaCarListingUrl = (vin, model) => {
  return `https://www.tesla.com/${globalConfig.language}_${globalConfig.market}/${getMappedModels(model)}/order/${vin}`;
};


// Send notification via Home Assistant
const sendNotification = async (device, message, vin, model) => {
  const supervisorToken = process.env.SUPERVISOR_TOKEN;

  if (!supervisorToken) {
    logErrorMessage("sendNotification", "Supervisor token not found.");
    return;
  }

  const url = `http://supervisor/core/api/services/notify/${device}`;
  let payload;

  if (vin && model) {
    payload = {
      title: "Tesla CPO Monitor",
      message,
      data: { url: composeTeslaCarListingUrl(vin, model) }
    }
  } else {
    payload = {
      title: "Tesla CPO Inventory Tracker",
      message
    }
  }

  try {
    await axios.post(
      url,
      payload,
      { headers: 
        { 
          "Authorization": `Bearer ${supervisorToken}`,
          "Content-Type": "application/json"
        }
      }
    );
  } catch (error) {
    logErrorMessage("sendNotification", `Error sending notification: ${error.message}`);
    logErrorMessage("sendNotification", `Sending notification: ${JSON.stringify(payload)}`);
  }
};

const loadYamlVersion = () => {
  try {
    const fileContents = fs.readFileSync(path.resolve(__dirname, 'config.yaml'), 'utf8');
    const data = yaml.load(fileContents);
    return data;
  } catch (error) {
    logErrorMessage("loadYamlVersion", `Failed to load yaml configuration for version: ${error.message}`);
  }
}

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

  const availableVehicles = [];
  const constructedUrls = [];

  config.models.forEach((model) => {
    logMessage("fetchCpoData", `Creating query for: ${model}`);
    const mappedModel = getMappedModels(model);
    const teslaV4ApiQuery = composeUrlQuery(mappedModel, config.market, config.language, config.postalCode, config.region);
    const composedURL = URL + '?query=' + JSON.stringify(teslaV4ApiQuery);
    constructedUrls.push(composedURL);
  });

  for (const url of constructedUrls) {
    try {
      const response = await axios.get(url, { headers: {'User-Agent':'Mozilla/5.0'}, timeout: 5000 });
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
            model: veh.Model,
          };
        }
      }).filter(Boolean); // Remove undefined entries

      logMessage("fetchCpoData", `Fetched ${vehicles.length} matching vehicles from Tesla CPO API.`);
      logMessage("fetchCpoData", `Matched Vehicles: ${JSON.stringify(vehicles)}`);

      // Send test notification with results
      if (config.test_notification) {
        if (vehicles.length > 0) {
          config.devices_to_notify.forEach((device) => {
            sendNotification(
              device,
              `Matched ${vehicles.length} vehicle(s) from Tesla CPO Inventory API - ${vehicles[0].model}.\nDisable 'Test Notification' in the addon's configuration to stop these messages.`,
            );
          });
        } else {
          config.devices_to_notify.forEach((device) => {
            sendNotification(
              device,
              `No matched vehicles from Tesla CPO Inventory API.\nDisable 'Test Notification' in the addon's configuration to stop these messages.`
            );
          });
        }
      }

      availableVehicles.push(vehicles);
    } catch (error) {
      logErrorMessage("fetchCpoData", `Something went wrong: ${error.message}, #error: ${error}`);
      return [];
    }
  };

  return availableVehicles.flat();
};

// Monitor VIN
const monitorVins = (config, db) => {
  const { vins, interval, models, devices_to_notify: devices } = config;

  if (!vins || !interval || !devices || !models.length) {
    logErrorMessage("monitorVins", "Configuration is missing a required field.");
    return;
  }

  setInterval(async () => {
    const vehicles = await fetchCpoData(config);

    // Process each vehicle
    vehicles.forEach(({ VIN, price, model }) => {
      db.get("SELECT price FROM vehicle WHERE vin = ?", [VIN], (err, row) => {
        if (err) {
          logErrorMessage("monitorVins", `Database error for VIN ${VIN} (line 124): ${err.message}`);
          return;
        }

        if (row) {
          const lastPrice = row.price;
          if (price !== lastPrice) {
            devices.forEach((device) => {
              sendNotification(
                device,
                `Tesla ${VIN} (${model}): Price changed from $${lastPrice} to $${price}.`,
                VIN,
                model
              );
            });
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
            devices.forEach((device) => {
              sendNotification(
                device,
                `Tesla VIN ${VIN} is no longer available.`
              );
            });
          }
        });
      }
    });
  }, interval * 60 * 1000);
};

const logMessage = (functionName, message, bootMessage) => {
  const currentTime = new Date().toISOString();
  if (bootMessage) {
    console.log(consoleColours.green, `[${currentTime}] [${functionName}] ${message}`);
  } else {
    console.log(`[${currentTime}] [${functionName}] ${message}`);
  }
};

const logErrorMessage = (functionName, message) => {
  const currentTime = new Date().toISOString();
  console.error(consoleColours.red ,`[${currentTime}] [${functionName}] - ERROR - ${message}`);
};

const main = () => {
  const addOnConfig = loadYamlVersion();
  
  logMessage("main", "===============================================", true);
  logMessage("main", "Starting Tesla CPO monitor...", true);
  logMessage("main", `Version: ${addOnConfig.version}`, true);
  logMessage("main", "Written by: @mwood77", true);
  logMessage("main", "Found a bug? Report it here: https://github.com/mwood77/ha-tesla-inventory-tracker/issues", true);
  logMessage("main", "===============================================", true);

  const localConfig = loadConfig();
  globalConfig = localConfig;
  const db = initDb();

  monitorVins(localConfig, db);
};

main();
