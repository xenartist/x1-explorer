// Dynamic RPC configuration
let CURRENT_RPC_URL = 'https://rpc-testnet.x1.wiki'; // Default

class X1RPC {
    constructor(url = null) {
        this.url = url || CURRENT_RPC_URL;
    }

    // Update RPC URL
    updateUrl(newUrl) {
        this.url = newUrl;
        CURRENT_RPC_URL = newUrl;
        console.log('RPC URL updated to:', newUrl);
    }

    // Get current URL
    getCurrentUrl() {
        return this.url;
    }

    // Test RPC connection
    async testConnection() {
        try {
            const result = await this.call('getHealth');
            return { connected: true, result };
        } catch (error) {
            try {
                // Fallback: try getSlot if getHealth fails
                const result = await this.call('getSlot');
                return { connected: true, result };
            } catch (fallbackError) {
                return { connected: false, error: fallbackError.message };
            }
        }
    }

    // Generic RPC call method
    async call(method, params = []) {
        try {
            const response = await fetch(this.url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: Date.now(),
                    method: method,
                    params: params
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error.message || 'Unknown error');
            }

            return data.result;
        } catch (error) {
            console.error('RPC call failed:', error);
            throw error;
        }
    }

    // Get account information with base64 encoding for program accounts
    async getAccountInfo(address) {
        try {
            // First try with base64 encoding (for programs with large data)
            return await this.call('getAccountInfo', [address, { 
                encoding: 'base64',
                commitment: 'confirmed'
            }]);
        } catch (error) {
            console.log('Base64 account info failed, trying jsonParsed:', error.message);
            // Fallback to jsonParsed for smaller accounts
            try {
                return await this.call('getAccountInfo', [address, { 
                    encoding: 'jsonParsed',
                    commitment: 'confirmed'
                }]);
            } catch (fallbackError) {
                console.log('JsonParsed account info also failed:', fallbackError.message);
                throw fallbackError;
            }
        }
    }

    // Alternative method to get account info with specific encoding
    async getAccountInfoWithEncoding(address, encoding = 'base64') {
        return await this.call('getAccountInfo', [address, { 
            encoding: encoding,
            commitment: 'confirmed'
        }]);
    }

    // Get transaction information - improved method for better transaction search
    async getTransaction(signature) {
        return await this.call('getTransaction', [signature, {
            encoding: 'jsonParsed',
            commitment: 'confirmed',
            maxSupportedTransactionVersion: 0
        }]);
    }

    // Get transaction information - backup method using base64 encoding
    async getTransactionBase64(signature) {
        return await this.call('getTransaction', [signature, {
            encoding: 'base64',
            commitment: 'confirmed',
            maxSupportedTransactionVersion: 0
        }]);
    }

    // Get block information
    async getBlock(slot) {
        return await this.call('getBlock', [slot, { 
            encoding: 'jsonParsed',
            transactionDetails: 'full',
            rewards: false,
            commitment: 'confirmed'
        }]);
    }

    // Get current slot
    async getSlot() {
        return await this.call('getSlot');
    }

    // Get blocks 
    async getBlocks(startSlot, endSlot) {
        return await this.call('getBlocks', [startSlot, endSlot]);
    }

    // Get program accounts
    async getProgramAccounts(programId) {
        return await this.call('getProgramAccounts', [programId]);
    }

    // Get token supply
    async getTokenSupply(mint) {
        return await this.call('getTokenSupply', [mint]);
    }

    // Get recent performance samples for TPS calculation
    async getRecentPerformanceSamples(limit = 1) {
        return await this.call('getRecentPerformanceSamples', [limit]);
    }

    // Calculate all 3 types of TPS using getRecentPerformanceSamples
    async getAllTPS() {
        try {
            // Get the most recent performance sample
            const samples = await this.getRecentPerformanceSamples(1);
            
            if (!samples || samples.length === 0) {
                throw new Error('No performance samples available');
            }

            const sample = samples[0];
            
            // Calculate all 3 types of TPS
            const totalTPS = sample.numTransactions / sample.samplePeriodSecs;
            const trueTPS = sample.numNonVoteTransactions / sample.samplePeriodSecs;
            const voteTPS = (sample.numTransactions - sample.numNonVoteTransactions) / sample.samplePeriodSecs;
            
            return {
                totalTPS: totalTPS,                    // Total TPS including votes
                trueTPS: trueTPS,                      // User transactions TPS (excluding votes)  
                voteTPS: voteTPS,                      // Vote transactions TPS
                totalTransactions: sample.numTransactions,
                nonVoteTransactions: sample.numNonVoteTransactions,
                voteTransactions: sample.numTransactions - sample.numNonVoteTransactions,
                numSlots: sample.numSlots,
                samplePeriodSecs: sample.samplePeriodSecs,
                slot: sample.slot,
                timestamp: Date.now()
            };

        } catch (error) {
            console.error('TPS calculation using performance samples failed:', error);
            throw error;
        }
    }

    // Improved search functionality
    async search(query) {
        const cleanQuery = query.trim();
        
        if (!cleanQuery) {
            throw new Error('Search query cannot be empty');
        }

        console.log('Search query:', cleanQuery);
        const searchResults = [];

        // 1. If it's a number, try searching as block number
        if (/^\d+$/.test(cleanQuery)) {
            try {
                const blockInfo = await this.getBlock(parseInt(cleanQuery));
                if (blockInfo) {
                    searchResults.push({
                        type: 'block',
                        data: blockInfo,
                        query: cleanQuery
                    });
                }
            } catch (e) {
                console.log('Block search failed:', e.message);
            }
        }

        // 2. If it looks like a transaction signature or address
        if (cleanQuery.length >= 32) {
            // Try transaction search first - using improved method
            try {
                console.log('Trying transaction search:', cleanQuery);
                const txInfo = await this.getTransaction(cleanQuery);
                if (txInfo) {
                    console.log('Transaction search successful:', txInfo);
                    searchResults.push({
                        type: 'transaction',
                        data: txInfo,
                        query: cleanQuery
                    });
                }
            } catch (e) {
                console.log('JSON transaction search failed:', e.message);
                
                // If JSON format fails, try base64 format
                try {
                    console.log('Trying base64 transaction search:', cleanQuery);
                    const txInfo = await this.getTransactionBase64(cleanQuery);
                    if (txInfo) {
                        console.log('Base64 transaction search successful:', txInfo);
                        searchResults.push({
                            type: 'transaction',
                            data: txInfo,
                            query: cleanQuery
                        });
                    }
                } catch (e2) {
                    console.log('Base64 transaction search also failed:', e2.message);
                }
            }

            // Try searching as account address (now with base64 support)
            try {
                console.log('Trying account search:', cleanQuery);
                const accountInfo = await this.getAccountInfo(cleanQuery);
                if (accountInfo && accountInfo.value) {
                    console.log('Account search successful:', accountInfo);
                    
                    // Check if this account is executable (i.e., a program)
                    if (accountInfo.value.executable) {
                        // This is a program account
                        searchResults.push({
                            type: 'program',
                            data: accountInfo.value,
                            query: cleanQuery
                        });
                    } else {
                        // Regular account
                        searchResults.push({
                            type: 'account',
                            data: accountInfo,
                            query: cleanQuery
                        });
                    }
                }
            } catch (e) {
                console.log('Account search failed:', e.message);
            }

            // Try searching as token mint
            try {
                console.log('Trying token search:', cleanQuery);
                const tokenInfo = await this.getTokenSupply(cleanQuery);
                if (tokenInfo) {
                    console.log('Token search successful:', tokenInfo);
                    searchResults.push({
                        type: 'token',
                        data: tokenInfo,
                        query: cleanQuery
                    });
                }
            } catch (e) {
                console.log('Token search failed:', e.message);
            }
        }

        console.log('Search results:', searchResults);

        if (searchResults.length === 0) {
            throw new Error('No matching results found. Please check your input.');
        }

        return searchResults;
    }

    // Add signature verification method
    async getSignatureStatus(signature) {
        return await this.call('getSignatureStatus', [signature]);
    }

    // Get transaction history
    async getSignaturesForAddress(address, limit = 10) {
        return await this.call('getSignaturesForAddress', [address, { limit }]);
    }

    // Get account transaction signatures
    async getSignaturesForAddress(address, options = {}) {
        const defaultOptions = {
            limit: 20, // Default to 20 transactions per page
            commitment: 'confirmed',
            ...options
        };
        return await this.call('getSignaturesForAddress', [address, defaultOptions]);
    }

    // Get multiple transactions by signatures
    async getMultipleTransactions(signatures) {
        const transactions = [];
        
        // Process in batches to avoid overwhelming the RPC
        const batchSize = 10;
        for (let i = 0; i < signatures.length; i += batchSize) {
            const batch = signatures.slice(i, i + batchSize);
            const batchPromises = batch.map(sig => 
                this.getTransaction(sig.signature).catch(error => {
                    console.warn(`Failed to fetch transaction ${sig.signature}:`, error);
                    return null;
                })
            );
            
            const batchResults = await Promise.all(batchPromises);
            transactions.push(...batchResults.filter(tx => tx !== null));
        }
        
        return transactions;
    }

    // Get vote account credits (only call when we know it's a vote account)
    async getVoteAccountCredits(votePubkey) {
        try {
            const voteAccounts = await this.call('getVoteAccounts', [{
                votePubkey: votePubkey
            }]);
            if (voteAccounts && voteAccounts.current && voteAccounts.current.length > 0) {
                return voteAccounts.current[0];
            }
            // Also check delinquent accounts
            if (voteAccounts && voteAccounts.delinquent && voteAccounts.delinquent.length > 0) {
                return voteAccounts.delinquent[0];
            }
            return null;
        } catch (error) {
            console.error('Failed to get vote account credits:', error);
            throw error;
        }
    }

    // Get stake account information
    async getStakeAccountInfo(stakePubkey) {
        try {
            // Use getAccountInfo to get raw account data
            const accountInfo = await this.call('getAccountInfo', [stakePubkey, {
                encoding: 'jsonParsed',
                commitment: 'confirmed'
            }]);

            // Get current epoch information
            const epochInfo = await this.call('getEpochInfo');
            
            if (!accountInfo?.value?.data?.parsed?.type === 'stake') {
                throw new Error('Not a valid stake account');
            }

            // Get stake account details
            const stakeData = accountInfo.value.data.parsed.info;
            const delegation = stakeData.stake?.delegation;
            
            // Fix stake status calculation logic
            let state = 'inactive';
            if (delegation) {
                const activationEpoch = Number(delegation.activationEpoch);
                const deactivationEpoch = Number(delegation.deactivationEpoch);
                const currentEpoch = Number(epochInfo.epoch);
                
                // Max u64 means no deactivation epoch
                const MAX_EPOCH = 18446744073709551615;

                if (deactivationEpoch !== MAX_EPOCH && deactivationEpoch <= currentEpoch) {
                    state = 'inactive';
                } else if (deactivationEpoch !== MAX_EPOCH && currentEpoch < deactivationEpoch) {
                    state = 'deactivating';
                } else if (currentEpoch >= activationEpoch) {
                    state = 'active';
                } else {
                    state = 'activating';
                }
            }

            return {
                state,
                accountInfo: accountInfo.value,
                stakeData,
                currentEpoch: epochInfo.epoch
            };
        } catch (error) {
            console.error('Failed to get stake account info:', error);
            throw error;
        }
    }

    // Get token metadata (supports both SPL Token and Token-2022)
    async getTokenMetadata(mintAddress) {
        try {
            // First check if it's a Token-2022 with metadata extension
            const mintInfo = await this.call('getAccountInfo', [mintAddress, {
                encoding: 'jsonParsed',
                commitment: 'confirmed'
            }]);

            if (!mintInfo?.value) {
                throw new Error('Token mint not found');
            }

            const mintData = mintInfo.value.data.parsed?.info;
            let metadata = {
                mintAuthority: mintData?.mintAuthority,
                freezeAuthority: mintData?.freezeAuthority,
                decimals: mintData?.decimals,
                supply: mintData?.supply,
                isInitialized: mintData?.isInitialized,
                extensions: null
            };

            // Check for Token-2022 extensions
            if (mintInfo.value.data.parsed?.info?.extensions) {
                metadata.extensions = mintInfo.value.data.parsed.info.extensions;
                
                // Look for metadata extension in Token-2022
                const metadataExtension = metadata.extensions.find(ext => ext.extension === 'tokenMetadata');
                if (metadataExtension) {
                    metadata.name = metadataExtension.state.name;
                    metadata.symbol = metadataExtension.state.symbol;
                    metadata.uri = metadataExtension.state.uri;
                    metadata.tokenType = 'Token-2022';
                    
                    // Fetch additional metadata from URI if available
                    if (metadata.uri) {
                        try {
                            const response = await fetch(metadata.uri);
                            const jsonMetadata = await response.json();
                            metadata.image = jsonMetadata.image;
                            metadata.description = jsonMetadata.description;
                            metadata.attributes = jsonMetadata.attributes;
                        } catch (e) {
                            console.log('Failed to fetch URI metadata:', e.message);
                        }
                    }
                    
                    return metadata;
                }
            }

            // If no Token-2022 metadata, try to find Metaplex metadata
            try {
                // Calculate metadata PDA for Metaplex
                const metadataPDA = await this.findMetadataPDA(mintAddress);
                const metadataAccount = await this.call('getAccountInfo', [metadataPDA, {
                    encoding: 'base64',
                    commitment: 'confirmed'
                }]);

                if (metadataAccount?.value) {
                    // Parse Metaplex metadata (simplified parsing)
                    metadata.tokenType = 'SPL Token';
                    metadata.hasMetaplex = true;
                    
                    // Try to get off-chain metadata
                    // Note: This is a simplified approach. In practice, you'd need to properly parse the Metaplex metadata account
                    // For now, we'll attempt some common metadata URIs
                    const commonUris = [
                        `https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/${mintAddress}/logo.png`,
                        `https://arweave.net/...` // You'd need the actual Arweave URI from the metadata account
                    ];
                    
                    // This is a placeholder - in a real implementation you'd parse the actual metadata account
                }
            } catch (e) {
                console.log('No Metaplex metadata found:', e.message);
            }

            metadata.tokenType = metadata.tokenType || 'SPL Token';
            return metadata;

        } catch (error) {
            console.error('Failed to get token metadata:', error);
            throw error;
        }
    }

    // Helper to calculate Metaplex metadata PDA
    async findMetadataPDA(mintAddress) {
        // This is a simplified version - in practice you'd use @solana/web3.js PublicKey.findProgramAddressSync
        // For now, we'll return a placeholder
        const METADATA_PROGRAM_ID = 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s';
        // In a real implementation, you'd calculate the PDA properly
        return `${METADATA_PROGRAM_ID}_${mintAddress}_metadata`;
    }
}

// Create RPC instance
const rpc = new X1RPC();
