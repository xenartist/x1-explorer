// RPC Server Configuration
const RPC_URL = 'https://rpc-testnet.x1.wiki';

class X1RPC {
    constructor(url) {
        this.url = url;
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

    // Get account information
    async getAccountInfo(address) {
        return await this.call('getAccountInfo', [address, { 
            encoding: 'jsonParsed' 
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

    // Get latest block height
    async getSlot() {
        return await this.call('getSlot');
    }

    // Get multiple blocks information
    async getBlocks(startSlot, endSlot) {
        return await this.call('getBlocks', [startSlot, endSlot]);
    }

    // Get program accounts
    async getProgramAccounts(programId) {
        return await this.call('getProgramAccounts', [programId]);
    }

    // Get token balance
    async getTokenAccountBalance(address) {
        return await this.call('getTokenAccountBalance', [address]);
    }

    // Get token supply
    async getTokenSupply(mint) {
        return await this.call('getTokenSupply', [mint]);
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

            // Try searching as account address
            try {
                console.log('Trying account search:', cleanQuery);
                const accountInfo = await this.getAccountInfo(cleanQuery);
                if (accountInfo && accountInfo.value) {
                    console.log('Account search successful:', accountInfo);
                    searchResults.push({
                        type: 'account',
                        data: accountInfo,
                        query: cleanQuery
                    });
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
}

// Create global RPC instance
const rpc = new X1RPC(RPC_URL);
