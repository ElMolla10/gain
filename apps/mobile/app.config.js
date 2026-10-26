// Apply distribution/pilot/personal-signing flags, then opt into the paid-team widget extension and (separately) Apple Health.
const { applyBuildFlags } = require("./build-flags");
const { applyRestLiveActivityConfig } = require("./plugins/rest-live-activity-config");
const { applyAppleHealthConfig } = require("./plugins/apple-health-config");

module.exports = ({ config }) => applyAppleHealthConfig(applyRestLiveActivityConfig(applyBuildFlags(config, process.env), process.env), process.env);
