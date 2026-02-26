const { v1: uuidv1 } = require('uuid');
const log4js = require("log4js");
const { fetchData } = require("./utilities.js");
const { URL_MAKO_ENTITLEMENT_SERVICES } = require("./constants");

const logger = log4js.getLogger("MakoStreamResolver");

function generateDeviceID() {
    const uuidStr = uuidv1().toUpperCase();
    return `W${uuidStr.slice(0, 8)}${uuidStr.slice(9)}`;
}

async function getTicketForStream(streamUrl, cdn) {
    const deviceId = generateDeviceID();
    logger.debug(`getTicketForStream => Generated device ID: ${deviceId}`);
    
    const link = `${URL_MAKO_ENTITLEMENT_SERVICES}?et=gt&lp=${streamUrl}&rv=${cdn}`;
    
    try {
        const ticketPage = await fetchData(link, true);
        
        if (!ticketPage?.tickets?.[0]) {
            logger.warn(`getTicketForStream => No tickets found for ${cdn}`);
            return null;
        }

        const ticket = ticketPage.tickets[0].ticket;
        const ticketUrl = ticketPage.tickets[0].url;
        
        // Build final playable URL
        let finalUrl = streamUrl;
        if (ticketUrl && !ticketUrl.startsWith('/')) {
            finalUrl = ticketUrl;
        }
        
        // Add ticket to URL
        if (finalUrl.includes('?')) {
            finalUrl = `${finalUrl}&${ticket}`;
        } else {
            finalUrl = `${finalUrl}?${ticket}`;
        }
        
        logger.debug(`getTicketForStream => Successfully got ticket for ${cdn}`);
        return finalUrl;
        
    } catch (error) {
        logger.error(`getTicketForStream => Error getting ticket: ${error.message}`);
        return null;
    }
}

async function resolveStreams(episodeStreams) {
    logger.debug(`resolveStreams => Resolving ${episodeStreams.length} streams`);
    
    const resolvedStreams = [];
    
    // Sort by CDN priority (like Python code does)
    const sortedStreams = episodeStreams.sort((a, b) => {
        return (b.cdnLB || 0) - (a.cdnLB || 0);
    });
    
    // Try AWS first, then AKAMAI (like Python code)
    const cdnOrder = ['AWS', 'AKAMAI'];
    
    for (const cdnName of cdnOrder) {
        const stream = sortedStreams.find(s => s.cdn === cdnName);
        if (!stream) continue;
        
        const playableUrl = await getTicketForStream(stream.url, stream.cdn);
        if (playableUrl) {
            resolvedStreams.push({
                name: `Mako ${stream.cdn}`,
                title: `${stream.cdn} CDN`,
                url: playableUrl,
                behaviorHints: {
                    notWebReady: false,
                    bingeGroup: `mako-${stream.cdn.toLowerCase()}`
                }
            });
        }
    }
    
    return resolvedStreams;
}

module.exports = {
    generateDeviceID,
    getTicketForStream,
    resolveStreams
};