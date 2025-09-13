"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.stableHash = stableHash;
exports.cardKey = cardKey;
exports.compNaturalKey = compNaturalKey;
const node_crypto_1 = __importDefault(require("node:crypto"));
function stableHash(obj) {
    // Deterministic JSON: sort keys shallowly
    const replacer = (_key, value) => {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            return Object.keys(value)
                .sort()
                .reduce((acc, k) => {
                acc[k] = value[k];
                return acc;
            }, {});
        }
        return value;
    };
    const json = JSON.stringify(obj, replacer);
    return node_crypto_1.default.createHash('sha256').update(json).digest('hex').slice(0, 32);
}
// Canonical Card key tuple
function cardKey(setCode, number, variantKey, language = 'EN') {
    return { setCode, number, variantKey: variantKey || '', language: language || 'EN' };
}
// CompSale dedupe key if no externalId
function compNaturalKey(input) {
    const soldAtIso = new Date(input.soldAt).toISOString().slice(0, 19);
    const base = {
        source: input.source,
        setCode: input.setCode,
        number: input.number,
        variantKey: input.variantKey || '',
        language: (input.language || 'EN').toUpperCase(),
        soldAt: soldAtIso,
        priceCents: input.priceCents,
        currency: input.currency,
    };
    return stableHash(base);
}
