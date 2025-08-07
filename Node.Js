require("dotenv").config();
const axios = require("axios");
const { refreshAccessToken } = require("./tokenRefresh");

async function main() {
  let accessToken = process.env.ACCESS_TOKEN;
  let refreshToken = process.env.REFRESH_TOKEN;
  const zapierWebhook = process.env.ZAPIER_WEBHOOK_URL;

  // 1. Try fetching timesheets
  try {
    const timesheetsResponse = await axios.get("https://rest.tsheets.com/api/v1/timesheets", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      params: {
        per_page: 5,
        sort: "date desc",
      },
    });

    await sendTimesheetsToZapier(timesheetsResponse.data.results.timesheets, zapierWebhook);
  } catch (error) {
    if (error.response && error.response.status === 401) {
      // Token expired, refresh it
      console.log("Access token expired. Refreshing...");
      const newTokens = await refreshAccessToken(refreshToken);

      accessToken = newTokens.access_token;
      refreshToken = newTokens.refresh_token;

      console.log("Tokens refreshed. Retrying API call...");

      // Retry fetching timesheets
      const timesheetsResponse = await axios.get("https://rest.tsheets.com/api/v1/timesheets", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        params: {
          per_page: 5,
          sort: "date desc",
        },
      });

      await sendTimesheetsToZapier(timesheetsResponse.data.results.timesheets, zapierWebhook);

      // Optionally: Save new tokens to .env or your secure storage
      console.log("New Access Token:", accessToken);
      console.log("New Refresh Token:", refreshToken);
    } else {
      console.error("Failed to fetch timesheets:", error.response?.data || error.message);
    }
  }
}

async function sendTimesheetsToZapier(timesheets, webhookUrl) {
  for (const id in timesheets) {
    const entry = timesheets[id];

    const payload = {
      employee: entry.user_id,
      clock_in: entry.start,
      clock_out: entry.end,
      job_code: entry.jobcode_id,
      notes: entry.notes || "No notes",
      duration: entry.duration / 3600,
      date: entry.date,
    };

    try {
      await axios.post(webhookUrl, payload);
      console.log(`Sent entry for user ${entry.user_id} to Zapier`);
    } catch (error) {
      console.error("Error sending to Zapier:", error.response?.data || error.message);
    }
  }
}

main();
