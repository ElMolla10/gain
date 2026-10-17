// Apply distribution/pilot/personal-signing flags, then opt into the paid-team widget extension.
const { applyBuildFlags } = require("./build-flags");
const { applyRestLiveActivityConfig } = require("./plugins/rest-live-activity-config");

module.exports = ({ config }) => applyRestLiveActivityConfig(applyBuildFlags(config, process.env), process.env);
