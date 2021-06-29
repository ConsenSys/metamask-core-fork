"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssetsController = void 0;
const events_1 = require("events");
const uuid_1 = require("uuid");
const async_mutex_1 = require("async-mutex");
const BaseController_1 = __importDefault(require("../BaseController"));
const util_1 = require("../util");
const constants_1 = require("../constants");
const assetsUtil_1 = require("./assetsUtil");
var SuggestedAssetStatus;
(function (SuggestedAssetStatus) {
    SuggestedAssetStatus["accepted"] = "accepted";
    SuggestedAssetStatus["failed"] = "failed";
    SuggestedAssetStatus["pending"] = "pending";
    SuggestedAssetStatus["rejected"] = "rejected";
})(SuggestedAssetStatus || (SuggestedAssetStatus = {}));
/**
 * Controller that stores assets and exposes convenience methods
 */
class AssetsController extends BaseController_1.default {
    /**
     * Creates a AssetsController instance
     *
     * @param options
     * @param options.onPreferencesStateChange - Allows subscribing to preference controller state changes
     * @param options.onNetworkStateChange - Allows subscribing to network controller state changes
     * @param options.getAssetName - Gets the name of the asset at the given address
     * @param options.getAssetSymbol - Gets the symbol of the asset at the given address
     * @param options.getCollectibleTokenURI - Gets the URI of the NFT at the given address, with the given ID
     * @param config - Initial options used to configure this controller
     * @param state - Initial state to set on this controller
     */
    constructor({ onPreferencesStateChange, onNetworkStateChange, getAssetName, getAssetSymbol, getCollectibleTokenURI, }, config, state) {
        super(config, state);
        this.mutex = new async_mutex_1.Mutex();
        /**
         * EventEmitter instance used to listen to specific EIP747 events
         */
        this.hub = new events_1.EventEmitter();
        /**
         * Name of this controller used during composition
         */
        this.name = 'AssetsController';
        this.defaultConfig = {
            networkType: constants_1.MAINNET,
            selectedAddress: '',
            chainId: '',
        };
        this.defaultState = {
            allCollectibleContracts: {},
            allCollectibles: {},
            allTokens: {},
            collectibleContracts: [],
            collectibles: [],
            ignoredCollectibles: [],
            ignoredTokens: [],
            suggestedAssets: [],
            tokens: [],
        };
        this.initialize();
        this.getAssetName = getAssetName;
        this.getAssetSymbol = getAssetSymbol;
        this.getCollectibleTokenURI = getCollectibleTokenURI;
        onPreferencesStateChange(({ selectedAddress }) => {
            var _a, _b, _c;
            const { allCollectibleContracts, allCollectibles, allTokens, } = this.state;
            const { chainId } = this.config;
            this.configure({ selectedAddress });
            this.update({
                collectibleContracts: ((_a = allCollectibleContracts[selectedAddress]) === null || _a === void 0 ? void 0 : _a[chainId]) || [],
                collectibles: ((_b = allCollectibles[selectedAddress]) === null || _b === void 0 ? void 0 : _b[chainId]) || [],
                tokens: ((_c = allTokens[selectedAddress]) === null || _c === void 0 ? void 0 : _c[chainId]) || [],
            });
        });
        onNetworkStateChange(({ provider }) => {
            var _a, _b, _c;
            const { allCollectibleContracts, allCollectibles, allTokens, } = this.state;
            const { selectedAddress } = this.config;
            const { chainId } = provider;
            this.configure({ chainId });
            this.update({
                collectibleContracts: ((_a = allCollectibleContracts[selectedAddress]) === null || _a === void 0 ? void 0 : _a[chainId]) || [],
                collectibles: ((_b = allCollectibles[selectedAddress]) === null || _b === void 0 ? void 0 : _b[chainId]) || [],
                tokens: ((_c = allTokens[selectedAddress]) === null || _c === void 0 ? void 0 : _c[chainId]) || [],
            });
        });
    }
    getCollectibleApi(contractAddress, tokenId) {
        return `https://api.opensea.io/api/v1/asset/${contractAddress}/${tokenId}`;
    }
    getCollectibleContractInformationApi(contractAddress) {
        return `https://api.opensea.io/api/v1/asset_contract/${contractAddress}`;
    }
    failSuggestedAsset(suggestedAssetMeta, error) {
        const failedSuggestedAssetMeta = Object.assign(Object.assign({}, suggestedAssetMeta), { status: SuggestedAssetStatus.failed, error });
        this.hub.emit(`${suggestedAssetMeta.id}:finished`, failedSuggestedAssetMeta);
    }
    /**
     * Request individual collectible information from OpenSea api
     *
     * @param contractAddress - Hex address of the collectible contract
     * @param tokenId - The collectible identifier
     * @returns - Promise resolving to the current collectible name and image
     */
    getCollectibleInformationFromApi(contractAddress, tokenId) {
        return __awaiter(this, void 0, void 0, function* () {
            const tokenURI = this.getCollectibleApi(contractAddress, tokenId);
            let collectibleInformation;
            /* istanbul ignore if */
            if (this.openSeaApiKey) {
                collectibleInformation = yield util_1.handleFetch(tokenURI, {
                    headers: { 'X-API-KEY': this.openSeaApiKey },
                });
            }
            else {
                collectibleInformation = yield util_1.handleFetch(tokenURI);
            }
            const { num_sales, background_color, image_url, image_preview_url, image_thumbnail_url, image_original_url, animation_url, animation_original_url, name, description, external_link, creator, last_sale, } = collectibleInformation;
            /* istanbul ignore next */
            const collectibleMetadata = Object.assign({}, { name }, creator && { creator }, description && { description }, image_url && { image: image_url }, num_sales && { numberOfSales: num_sales }, background_color && { backgroundColor: background_color }, image_preview_url && { imagePreview: image_preview_url }, image_thumbnail_url && { imageThumbnail: image_thumbnail_url }, image_original_url && { imageOriginal: image_original_url }, animation_url && { animation: animation_url }, animation_original_url && {
                animationOriginal: animation_original_url,
            }, external_link && { externalLink: external_link }, last_sale && { lastSale: last_sale });
            return collectibleMetadata;
        });
    }
    /**
     * Request individual collectible information from contracts that follows Metadata Interface
     *
     * @param contractAddress - Hex address of the collectible contract
     * @param tokenId - The collectible identifier
     * @returns - Promise resolving to the current collectible name and image
     */
    getCollectibleInformationFromTokenURI(contractAddress, tokenId) {
        return __awaiter(this, void 0, void 0, function* () {
            const tokenURI = yield this.getCollectibleTokenURI(contractAddress, tokenId);
            const object = yield util_1.handleFetch(tokenURI);
            const image = Object.prototype.hasOwnProperty.call(object, 'image')
                ? 'image'
                : /* istanbul ignore next */ 'image_url';
            return { image: object[image], name: object.name };
        });
    }
    /**
     * Request individual collectible information (name, image url and description)
     *
     * @param contractAddress - Hex address of the collectible contract
     * @param tokenId - The collectible identifier
     * @returns - Promise resolving to the current collectible name and image
     */
    getCollectibleInformation(contractAddress, tokenId) {
        return __awaiter(this, void 0, void 0, function* () {
            let information;
            // First try with OpenSea
            information = yield util_1.safelyExecute(() => __awaiter(this, void 0, void 0, function* () {
                return yield this.getCollectibleInformationFromApi(contractAddress, tokenId);
            }));
            if (information) {
                return information;
            }
            // Then following ERC721 standard
            information = yield util_1.safelyExecute(() => __awaiter(this, void 0, void 0, function* () {
                return yield this.getCollectibleInformationFromTokenURI(contractAddress, tokenId);
            }));
            /* istanbul ignore next */
            if (information) {
                return information;
            }
            /* istanbul ignore next */
            return {};
        });
    }
    /**
     * Request collectible contract information from OpenSea api
     *
     * @param contractAddress - Hex address of the collectible contract
     * @returns - Promise resolving to the current collectible name and image
     */
    getCollectibleContractInformationFromApi(contractAddress) {
        return __awaiter(this, void 0, void 0, function* () {
            const api = this.getCollectibleContractInformationApi(contractAddress);
            let apiCollectibleContractObject;
            /* istanbul ignore if */
            if (this.openSeaApiKey) {
                apiCollectibleContractObject = yield util_1.handleFetch(api, {
                    headers: { 'X-API-KEY': this.openSeaApiKey },
                });
            }
            else {
                apiCollectibleContractObject = yield util_1.handleFetch(api);
            }
            return apiCollectibleContractObject;
        });
    }
    /**
     * Request collectible contract information from the contract itself
     *
     * @param contractAddress - Hex address of the collectible contract
     * @returns - Promise resolving to the current collectible name and image
     */
    getCollectibleContractInformationFromContract(contractAddress) {
        return __awaiter(this, void 0, void 0, function* () {
            const name = yield this.getAssetName(contractAddress);
            const symbol = yield this.getAssetSymbol(contractAddress);
            return {
                name,
                symbol,
                address: contractAddress,
                asset_contract_type: null,
                created_date: null,
                schema_name: null,
                total_supply: null,
                description: null,
                external_link: null,
                image_url: null,
            };
        });
    }
    /**
     * Request collectible contract information from OpenSea api
     *
     * @param contractAddress - Hex address of the collectible contract
     * @returns - Promise resolving to the collectible contract name, image and description
     */
    getCollectibleContractInformation(contractAddress) {
        return __awaiter(this, void 0, void 0, function* () {
            let information;
            // First try with OpenSea
            information = yield util_1.safelyExecute(() => __awaiter(this, void 0, void 0, function* () {
                return yield this.getCollectibleContractInformationFromApi(contractAddress);
            }));
            if (information) {
                return information;
            }
            // Then following ERC721 standard
            information = yield util_1.safelyExecute(() => __awaiter(this, void 0, void 0, function* () {
                return yield this.getCollectibleContractInformationFromContract(contractAddress);
            }));
            if (information) {
                return information;
            }
            /* istanbul ignore next */
            return {
                address: contractAddress,
                asset_contract_type: null,
                created_date: null,
                name: null,
                schema_name: null,
                symbol: null,
                total_supply: null,
                description: null,
                external_link: null,
                image_url: null,
            };
        });
    }
    /**
     * Adds an individual collectible to the stored collectible list
     *
     * @param address - Hex address of the collectible contract
     * @param tokenId - The collectible identifier
     * @param opts - Collectible optional information (name, image and description)
     * @returns - Promise resolving to the current collectible list
     */
    addIndividualCollectible(address, tokenId, collectibleMetadata) {
        return __awaiter(this, void 0, void 0, function* () {
            const releaseLock = yield this.mutex.acquire();
            try {
                address = util_1.toChecksumHexAddress(address);
                const { allCollectibles, collectibles } = this.state;
                const { chainId, selectedAddress } = this.config;
                const existingEntry = collectibles.find((collectible) => collectible.address === address && collectible.tokenId === tokenId);
                /* istanbul ignore next */
                collectibleMetadata =
                    collectibleMetadata ||
                        (yield this.getCollectibleInformation(address, tokenId));
                if (existingEntry) {
                    const differentMetadata = assetsUtil_1.compareCollectiblesMetadata(collectibleMetadata, existingEntry);
                    if (differentMetadata) {
                        const indexToRemove = collectibles.findIndex((collectible) => collectible.address === address &&
                            collectible.tokenId === tokenId);
                        /* istanbul ignore next */
                        if (indexToRemove !== -1) {
                            collectibles.splice(indexToRemove, 1);
                        }
                    }
                    else {
                        return collectibles;
                    }
                }
                const newEntry = Object.assign({ address,
                    tokenId }, collectibleMetadata);
                const newCollectibles = [...collectibles, newEntry];
                const addressCollectibles = allCollectibles[selectedAddress];
                const newAddressCollectibles = Object.assign(Object.assign({}, addressCollectibles), { [chainId]: newCollectibles });
                const newAllCollectibles = Object.assign(Object.assign({}, allCollectibles), { [selectedAddress]: newAddressCollectibles });
                this.update({
                    allCollectibles: newAllCollectibles,
                    collectibles: newCollectibles,
                });
                return newCollectibles;
            }
            finally {
                releaseLock();
            }
        });
    }
    /**
     * Adds a collectible contract to the stored collectible contracts list
     *
     * @param address - Hex address of the collectible contract
     * @param detection? - Whether the collectible is manually added or auto-detected
     * @returns - Promise resolving to the current collectible contracts list
     */
    addCollectibleContract(address, detection) {
        return __awaiter(this, void 0, void 0, function* () {
            const releaseLock = yield this.mutex.acquire();
            try {
                address = util_1.toChecksumHexAddress(address);
                const { allCollectibleContracts, collectibleContracts } = this.state;
                const { chainId, selectedAddress } = this.config;
                const existingEntry = collectibleContracts.find((collectibleContract) => collectibleContract.address === address);
                if (existingEntry) {
                    return collectibleContracts;
                }
                const contractInformation = yield this.getCollectibleContractInformation(address);
                const { asset_contract_type, created_date, name, schema_name, symbol, total_supply, description, external_link, image_url, } = contractInformation;
                // If being auto-detected opensea information is expected
                // Oherwise at least name and symbol from contract is needed
                if ((detection && !image_url) ||
                    Object.keys(contractInformation).length === 0) {
                    return collectibleContracts;
                }
                /* istanbul ignore next */
                const newEntry = Object.assign({}, { address }, description && { description }, name && { name }, image_url && { logo: image_url }, symbol && { symbol }, total_supply !== null && { totalSupply: total_supply }, asset_contract_type && { assetContractType: asset_contract_type }, created_date && { createdDate: created_date }, schema_name && { schemaName: schema_name }, external_link && { externalLink: external_link });
                const newCollectibleContracts = [...collectibleContracts, newEntry];
                const addressCollectibleContracts = allCollectibleContracts[selectedAddress];
                const newAddressCollectibleContracts = Object.assign(Object.assign({}, addressCollectibleContracts), { [chainId]: newCollectibleContracts });
                const newAllCollectibleContracts = Object.assign(Object.assign({}, allCollectibleContracts), { [selectedAddress]: newAddressCollectibleContracts });
                this.update({
                    allCollectibleContracts: newAllCollectibleContracts,
                    collectibleContracts: newCollectibleContracts,
                });
                return newCollectibleContracts;
            }
            finally {
                releaseLock();
            }
        });
    }
    /**
     * Removes an individual collectible from the stored token list and saves it in ignored collectibles list
     *
     * @param address - Hex address of the collectible contract
     * @param tokenId - Token identifier of the collectible
     */
    removeAndIgnoreIndividualCollectible(address, tokenId) {
        address = util_1.toChecksumHexAddress(address);
        const { allCollectibles, collectibles, ignoredCollectibles } = this.state;
        const { chainId, selectedAddress } = this.config;
        const newIgnoredCollectibles = [...ignoredCollectibles];
        const newCollectibles = collectibles.filter((collectible) => {
            if (collectible.address === address && collectible.tokenId === tokenId) {
                const alreadyIgnored = newIgnoredCollectibles.find((c) => c.address === address && c.tokenId === tokenId);
                !alreadyIgnored && newIgnoredCollectibles.push(collectible);
                return false;
            }
            return true;
        });
        const addressCollectibles = allCollectibles[selectedAddress];
        const newAddressCollectibles = Object.assign(Object.assign({}, addressCollectibles), { [chainId]: newCollectibles });
        const newAllCollectibles = Object.assign(Object.assign({}, allCollectibles), { [selectedAddress]: newAddressCollectibles });
        this.update({
            allCollectibles: newAllCollectibles,
            collectibles: newCollectibles,
            ignoredCollectibles: newIgnoredCollectibles,
        });
    }
    /**
     * Removes an individual collectible from the stored token list
     *
     * @param address - Hex address of the collectible contract
     * @param tokenId - Token identifier of the collectible
     */
    removeIndividualCollectible(address, tokenId) {
        address = util_1.toChecksumHexAddress(address);
        const { allCollectibles, collectibles } = this.state;
        const { chainId, selectedAddress } = this.config;
        const newCollectibles = collectibles.filter((collectible) => !(collectible.address === address && collectible.tokenId === tokenId));
        const addressCollectibles = allCollectibles[selectedAddress];
        const newAddressCollectibles = Object.assign(Object.assign({}, addressCollectibles), { [chainId]: newCollectibles });
        const newAllCollectibles = Object.assign(Object.assign({}, allCollectibles), { [selectedAddress]: newAddressCollectibles });
        this.update({
            allCollectibles: newAllCollectibles,
            collectibles: newCollectibles,
        });
    }
    /**
     * Removes a collectible contract to the stored collectible contracts list
     *
     * @param address - Hex address of the collectible contract
     * @returns - Promise resolving to the current collectible contracts list
     */
    removeCollectibleContract(address) {
        address = util_1.toChecksumHexAddress(address);
        const { allCollectibleContracts, collectibleContracts } = this.state;
        const { chainId, selectedAddress } = this.config;
        const newCollectibleContracts = collectibleContracts.filter((collectibleContract) => !(collectibleContract.address === address));
        const addressCollectibleContracts = allCollectibleContracts[selectedAddress];
        const newAddressCollectibleContracts = Object.assign(Object.assign({}, addressCollectibleContracts), { [chainId]: newCollectibleContracts });
        const newAllCollectibleContracts = Object.assign(Object.assign({}, allCollectibleContracts), { [selectedAddress]: newAddressCollectibleContracts });
        this.update({
            allCollectibleContracts: newAllCollectibleContracts,
            collectibleContracts: newCollectibleContracts,
        });
        return newCollectibleContracts;
    }
    /**
     * Sets an OpenSea API key to retrieve collectible information
     *
     * @param openSeaApiKey - OpenSea API key
     */
    setApiKey(openSeaApiKey) {
        this.openSeaApiKey = openSeaApiKey;
    }
    /**
     * Adds a token to the stored token list
     *
     * @param address - Hex address of the token contract
     * @param symbol - Symbol of the token
     * @param decimals - Number of decimals the token uses
     * @param image - Image of the token
     * @returns - Current token list
     */
    addToken(address, symbol, decimals, image) {
        return __awaiter(this, void 0, void 0, function* () {
            const releaseLock = yield this.mutex.acquire();
            try {
                address = util_1.toChecksumHexAddress(address);
                const { allTokens, tokens } = this.state;
                const { chainId, selectedAddress } = this.config;
                const newEntry = { address, symbol, decimals, image };
                const previousEntry = tokens.find((token) => token.address === address);
                if (previousEntry) {
                    const previousIndex = tokens.indexOf(previousEntry);
                    tokens[previousIndex] = newEntry;
                }
                else {
                    tokens.push(newEntry);
                }
                const addressTokens = allTokens[selectedAddress];
                const newAddressTokens = Object.assign(Object.assign({}, addressTokens), { [chainId]: tokens });
                const newAllTokens = Object.assign(Object.assign({}, allTokens), { [selectedAddress]: newAddressTokens });
                const newTokens = [...tokens];
                this.update({ allTokens: newAllTokens, tokens: newTokens });
                return newTokens;
            }
            finally {
                releaseLock();
            }
        });
    }
    /**
     * Adds a batch of tokens to the stored token list
     *
     * @param tokens - Array of Tokens to be added or updated
     * @returns - Current token list
     */
    addTokens(tokensToAdd) {
        return __awaiter(this, void 0, void 0, function* () {
            const releaseLock = yield this.mutex.acquire();
            const { allTokens, tokens } = this.state;
            const { chainId, selectedAddress } = this.config;
            try {
                tokensToAdd.forEach((tokenToAdd) => {
                    const { address, symbol, decimals, image } = tokenToAdd;
                    const checksumAddress = util_1.toChecksumHexAddress(address);
                    const newEntry = {
                        address: checksumAddress,
                        symbol,
                        decimals,
                        image,
                    };
                    const previousEntry = tokens.find((token) => token.address === checksumAddress);
                    if (previousEntry) {
                        const previousIndex = tokens.indexOf(previousEntry);
                        tokens[previousIndex] = newEntry;
                    }
                    else {
                        tokens.push(newEntry);
                    }
                });
                const addressTokens = allTokens[selectedAddress];
                const newAddressTokens = Object.assign(Object.assign({}, addressTokens), { [chainId]: tokens });
                const newAllTokens = Object.assign(Object.assign({}, allTokens), { [selectedAddress]: newAddressTokens });
                const newTokens = [...tokens];
                this.update({ allTokens: newAllTokens, tokens: newTokens });
                return newTokens;
            }
            finally {
                releaseLock();
            }
        });
    }
    /**
     * Adds a new suggestedAsset to state. Parameters will be validated according to
     * asset type being watched. A `<suggestedAssetMeta.id>:pending` hub event will be emitted once added.
     *
     * @param asset - Asset to be watched. For now only ERC20 tokens are accepted.
     * @param type - Asset type
     * @returns - Object containing a promise resolving to the suggestedAsset address if accepted
     */
    watchAsset(asset, type) {
        return __awaiter(this, void 0, void 0, function* () {
            const suggestedAssetMeta = {
                asset,
                id: uuid_1.v1(),
                status: SuggestedAssetStatus.pending,
                time: Date.now(),
                type,
            };
            try {
                switch (type) {
                    case 'ERC20':
                        util_1.validateTokenToWatch(asset);
                        break;
                    default:
                        throw new Error(`Asset of type ${type} not supported`);
                }
            }
            catch (error) {
                this.failSuggestedAsset(suggestedAssetMeta, error);
                return Promise.reject(error);
            }
            const result = new Promise((resolve, reject) => {
                this.hub.once(`${suggestedAssetMeta.id}:finished`, (meta) => {
                    switch (meta.status) {
                        case SuggestedAssetStatus.accepted:
                            return resolve(meta.asset.address);
                        case SuggestedAssetStatus.rejected:
                            return reject(new Error('User rejected to watch the asset.'));
                        case SuggestedAssetStatus.failed:
                            return reject(new Error(meta.error.message));
                        /* istanbul ignore next */
                        default:
                            return reject(new Error(`Unknown status: ${meta.status}`));
                    }
                });
            });
            const { suggestedAssets } = this.state;
            suggestedAssets.push(suggestedAssetMeta);
            this.update({ suggestedAssets: [...suggestedAssets] });
            this.hub.emit('pendingSuggestedAsset', suggestedAssetMeta);
            return { result, suggestedAssetMeta };
        });
    }
    /**
     * Accepts to watch an asset and updates it's status and deletes the suggestedAsset from state,
     * adding the asset to corresponding asset state. In this case ERC20 tokens.
     * A `<suggestedAssetMeta.id>:finished` hub event is fired after accepted or failure.
     *
     * @param suggestedAssetID - ID of the suggestedAsset to accept
     * @returns - Promise resolving when this operation completes
     */
    acceptWatchAsset(suggestedAssetID) {
        return __awaiter(this, void 0, void 0, function* () {
            const { suggestedAssets } = this.state;
            const index = suggestedAssets.findIndex(({ id }) => suggestedAssetID === id);
            const suggestedAssetMeta = suggestedAssets[index];
            try {
                switch (suggestedAssetMeta.type) {
                    case 'ERC20':
                        const { address, symbol, decimals, image } = suggestedAssetMeta.asset;
                        yield this.addToken(address, symbol, decimals, image);
                        suggestedAssetMeta.status = SuggestedAssetStatus.accepted;
                        this.hub.emit(`${suggestedAssetMeta.id}:finished`, suggestedAssetMeta);
                        break;
                    default:
                        throw new Error(`Asset of type ${suggestedAssetMeta.type} not supported`);
                }
            }
            catch (error) {
                this.failSuggestedAsset(suggestedAssetMeta, error);
            }
            const newSuggestedAssets = suggestedAssets.filter(({ id }) => id !== suggestedAssetID);
            this.update({ suggestedAssets: [...newSuggestedAssets] });
        });
    }
    /**
     * Rejects a watchAsset request based on its ID by setting its status to "rejected"
     * and emitting a `<suggestedAssetMeta.id>:finished` hub event.
     *
     * @param suggestedAssetID - ID of the suggestedAsset to accept
     */
    rejectWatchAsset(suggestedAssetID) {
        const { suggestedAssets } = this.state;
        const index = suggestedAssets.findIndex(({ id }) => suggestedAssetID === id);
        const suggestedAssetMeta = suggestedAssets[index];
        if (!suggestedAssetMeta) {
            return;
        }
        suggestedAssetMeta.status = SuggestedAssetStatus.rejected;
        this.hub.emit(`${suggestedAssetMeta.id}:finished`, suggestedAssetMeta);
        const newSuggestedAssets = suggestedAssets.filter(({ id }) => id !== suggestedAssetID);
        this.update({ suggestedAssets: [...newSuggestedAssets] });
    }
    /**
     * Adds a collectible and respective collectible contract to the stored collectible and collectible contracts lists
     *
     * @param address - Hex address of the collectible contract
     * @param tokenId - The collectible identifier
     * @param collectibleMetadata - Collectible optional metadata
     * @param detection? - Whether the collectible is manually added or autodetected
     * @returns - Promise resolving to the current collectible list
     */
    addCollectible(address, tokenId, collectibleMetadata, detection) {
        return __awaiter(this, void 0, void 0, function* () {
            address = util_1.toChecksumHexAddress(address);
            const newCollectibleContracts = yield this.addCollectibleContract(address, detection);
            collectibleMetadata =
                collectibleMetadata ||
                    (yield this.getCollectibleInformation(address, tokenId));
            // If collectible contract was not added, do not add individual collectible
            const collectibleContract = newCollectibleContracts.find((contract) => contract.address === address);
            // If collectible contract information, add individual collectible
            if (collectibleContract) {
                yield this.addIndividualCollectible(address, tokenId, collectibleMetadata);
            }
        });
    }
    /**
     * Removes a token from the stored token list and saves it in ignored tokens list
     *
     * @param address - Hex address of the token contract
     */
    removeAndIgnoreToken(address) {
        address = util_1.toChecksumHexAddress(address);
        const { allTokens, tokens, ignoredTokens } = this.state;
        const { chainId, selectedAddress } = this.config;
        const newIgnoredTokens = [...ignoredTokens];
        const newTokens = tokens.filter((token) => {
            if (token.address === address) {
                const alreadyIgnored = newIgnoredTokens.find((t) => t.address === address);
                !alreadyIgnored && newIgnoredTokens.push(token);
                return false;
            }
            return true;
        });
        const addressTokens = allTokens[selectedAddress];
        const newAddressTokens = Object.assign(Object.assign({}, addressTokens), { [chainId]: newTokens });
        const newAllTokens = Object.assign(Object.assign({}, allTokens), { [selectedAddress]: newAddressTokens });
        this.update({
            allTokens: newAllTokens,
            tokens: newTokens,
            ignoredTokens: newIgnoredTokens,
        });
    }
    /**
     * Removes a token from the stored token list
     *
     * @param address - Hex address of the token contract
     */
    removeToken(address) {
        address = util_1.toChecksumHexAddress(address);
        const { allTokens, tokens } = this.state;
        const { chainId, selectedAddress } = this.config;
        const newTokens = tokens.filter((token) => token.address !== address);
        const addressTokens = allTokens[selectedAddress];
        const newAddressTokens = Object.assign(Object.assign({}, addressTokens), { [chainId]: newTokens });
        const newAllTokens = Object.assign(Object.assign({}, allTokens), { [selectedAddress]: newAddressTokens });
        this.update({ allTokens: newAllTokens, tokens: newTokens });
    }
    /**
     * Removes a collectible from the stored token list
     *
     * @param address - Hex address of the collectible contract
     * @param tokenId - Token identifier of the collectible
     */
    removeCollectible(address, tokenId) {
        address = util_1.toChecksumHexAddress(address);
        this.removeIndividualCollectible(address, tokenId);
        const { collectibles } = this.state;
        const remainingCollectible = collectibles.find((collectible) => collectible.address === address);
        if (!remainingCollectible) {
            this.removeCollectibleContract(address);
        }
    }
    /**
     * Removes a collectible from the stored token list and saves it in ignored collectibles list
     *
     * @param address - Hex address of the collectible contract
     * @param tokenId - Token identifier of the collectible
     */
    removeAndIgnoreCollectible(address, tokenId) {
        address = util_1.toChecksumHexAddress(address);
        this.removeAndIgnoreIndividualCollectible(address, tokenId);
        const { collectibles } = this.state;
        const remainingCollectible = collectibles.find((collectible) => collectible.address === address);
        if (!remainingCollectible) {
            this.removeCollectibleContract(address);
        }
    }
    /**
     * Removes all tokens from the ignored list
     */
    clearIgnoredTokens() {
        this.update({ ignoredTokens: [] });
    }
    /**
     * Removes all collectibles from the ignored list
     */
    clearIgnoredCollectibles() {
        this.update({ ignoredCollectibles: [] });
    }
}
exports.AssetsController = AssetsController;
exports.default = AssetsController;
//# sourceMappingURL=AssetsController.js.map