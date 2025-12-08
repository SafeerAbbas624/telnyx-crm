/**
 * Sequence & Scheduled Message Worker
 *
 * This worker processes:
 * 1. Sequence enrollments by calling the /api/sequences/process endpoint
 * 2. Scheduled messages by calling the /api/cron/process-scheduled-messages endpoint
 *
 * It handles:
 * - Executing due sequence steps (EMAIL, SMS, TASK)
 * - Executing scheduled SMS and EMAIL messages
 * - Rate limiting
 * - Quiet hours enforcement
 * - DNC/unsubscribe checks
 *
 * Configuration via environment variables:
 * - SEQUENCE_PROCESS_INTERVAL_MS: How often to process (default: 60000ms = 1 minute)
 * - INTERNAL_API_KEY: Optional security key for the process endpoint
 * - APP_URL: Base URL of the application (default: http://localhost:3000)
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var PROCESS_INTERVAL = parseInt(process.env.SEQUENCE_PROCESS_INTERVAL_MS || "60000");
var INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || "";
var APP_URL = process.env.APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
// Sequence processing stats
var isProcessingSequences = false;
var lastSequenceProcessTime = null;
var sequenceProcessCount = 0;
var sequenceTotalProcessed = 0;
var sequenceTotalFailed = 0;
// Scheduled message processing stats
var isProcessingScheduled = false;
var lastScheduledProcessTime = null;
var scheduledProcessCount = 0;
var scheduledTotalSent = 0;
var scheduledTotalFailed = 0;
function processSequences() {
    return __awaiter(this, void 0, void 0, function () {
        var startTime, headers, response, errorText, result, error_1;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (isProcessingSequences) {
                        console.log("[Worker] Sequences: Already processing, skipping...");
                        return [2 /*return*/];
                    }
                    isProcessingSequences = true;
                    startTime = Date.now();
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 6, 7, 8]);
                    console.log("[Worker] Sequences: Starting process cycle #".concat(++sequenceProcessCount));
                    headers = {
                        "Content-Type": "application/json",
                    };
                    if (INTERNAL_API_KEY) {
                        headers["x-internal-key"] = INTERNAL_API_KEY;
                    }
                    return [4 /*yield*/, fetch("".concat(APP_URL, "/api/sequences/process"), {
                            method: "POST",
                            headers: headers,
                        })];
                case 2:
                    response = _b.sent();
                    if (!!response.ok) return [3 /*break*/, 4];
                    return [4 /*yield*/, response.text()];
                case 3:
                    errorText = _b.sent();
                    throw new Error("HTTP ".concat(response.status, ": ").concat(errorText));
                case 4: return [4 /*yield*/, response.json()];
                case 5:
                    result = _b.sent();
                    lastSequenceProcessTime = new Date();
                    if ((_a = result.message) === null || _a === void 0 ? void 0 : _a.includes("quiet hours")) {
                        console.log("[Worker] Sequences: Skipped - quiet hours");
                    }
                    else {
                        sequenceTotalProcessed += result.processed || 0;
                        sequenceTotalFailed += result.failed || 0;
                        if (result.processed > 0 || result.failed > 0) {
                            console.log("[Worker] Sequences: Done in ".concat(Date.now() - startTime, "ms - ") +
                                "Processed: ".concat(result.processed, ", Skipped: ").concat(result.skipped, ", Failed: ").concat(result.failed));
                        }
                    }
                    return [3 /*break*/, 8];
                case 6:
                    error_1 = _b.sent();
                    console.error("[Worker] Sequences: Error -", error_1.message);
                    return [3 /*break*/, 8];
                case 7:
                    isProcessingSequences = false;
                    return [7 /*endfinally*/];
                case 8: return [2 /*return*/];
            }
        });
    });
}
function processScheduledMessages() {
    return __awaiter(this, void 0, void 0, function () {
        var startTime, headers, response, errorText, result, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (isProcessingScheduled) {
                        console.log("[Worker] Scheduled: Already processing, skipping...");
                        return [2 /*return*/];
                    }
                    isProcessingScheduled = true;
                    startTime = Date.now();
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 6, 7, 8]);
                    headers = {
                        "Content-Type": "application/json",
                    };
                    if (INTERNAL_API_KEY) {
                        headers["x-internal-key"] = INTERNAL_API_KEY;
                    }
                    return [4 /*yield*/, fetch("".concat(APP_URL, "/api/cron/process-scheduled-messages"), {
                            method: "POST",
                            headers: headers,
                        })];
                case 2:
                    response = _a.sent();
                    if (!!response.ok) return [3 /*break*/, 4];
                    return [4 /*yield*/, response.text()];
                case 3:
                    errorText = _a.sent();
                    throw new Error("HTTP ".concat(response.status, ": ").concat(errorText));
                case 4: return [4 /*yield*/, response.json()];
                case 5:
                    result = _a.sent();
                    lastScheduledProcessTime = new Date();
                    scheduledProcessCount++;
                    scheduledTotalSent += result.sent || 0;
                    scheduledTotalFailed += result.failed || 0;
                    if (result.processed > 0) {
                        console.log("[Worker] Scheduled: Done in ".concat(Date.now() - startTime, "ms - ") +
                            "Processed: ".concat(result.processed, ", Sent: ").concat(result.sent, ", Failed: ").concat(result.failed));
                    }
                    return [3 /*break*/, 8];
                case 6:
                    error_2 = _a.sent();
                    console.error("[Worker] Scheduled: Error -", error_2.message);
                    return [3 /*break*/, 8];
                case 7:
                    isProcessingScheduled = false;
                    return [7 /*endfinally*/];
                case 8: return [2 /*return*/];
            }
        });
    });
}
function runAllProcessors() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: 
                // Run both in parallel since they're independent
                return [4 /*yield*/, Promise.all([
                        processSequences(),
                        processScheduledMessages()
                    ])];
                case 1:
                    // Run both in parallel since they're independent
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
// Status logging every 5 minutes
setInterval(function () {
    console.log("[Worker] Status - " +
        "Sequences: Cycles=".concat(sequenceProcessCount, ", Processed=").concat(sequenceTotalProcessed, ", Failed=").concat(sequenceTotalFailed, " | ") +
        "Scheduled: Cycles=".concat(scheduledProcessCount, ", Sent=").concat(scheduledTotalSent, ", Failed=").concat(scheduledTotalFailed));
}, 300000);
// Main loop
console.log("[Worker] Starting with ".concat(PROCESS_INTERVAL, "ms interval"));
console.log("[Worker] API URLs:");
console.log("  - Sequences: ".concat(APP_URL, "/api/sequences/process"));
console.log("  - Scheduled: ".concat(APP_URL, "/api/cron/process-scheduled-messages"));
// Run immediately on start
runAllProcessors();
// Then run on interval
setInterval(runAllProcessors, PROCESS_INTERVAL);
// Handle graceful shutdown
process.on("SIGTERM", function () {
    console.log("[Worker] Received SIGTERM, shutting down...");
    process.exit(0);
});
process.on("SIGINT", function () {
    console.log("[Worker] Received SIGINT, shutting down...");
    process.exit(0);
});
