const fs = require('fs').promises;


const OUT_OF_STOCK = "OUT_OF_STOCK";

const Errors = {
    OpenPageError: "OpenPageError", 
    ParseError: "ParseError"
}

const Pharmacy = {
    Zdravcity: "Zdravcity",
    AptekaRu: "AptekaRu",
    Eapteka: "Eapteka",
    Ozon: "Ozon",
    Gorzdrav: "Gorzdrav",
    Planetazdorovo: "Planetazdorovo"
}

const PharmacySiteDomain = {};
PharmacySiteDomain[Pharmacy.Zdravcity]      = "https://zdravcity.ru";
PharmacySiteDomain[Pharmacy.AptekaRu]       = "https://apteka.ru";
PharmacySiteDomain[Pharmacy.Eapteka]        = "https://www.eapteka.ru";
PharmacySiteDomain[Pharmacy.Ozon]           = "https://www.ozon.ru";
PharmacySiteDomain[Pharmacy.Gorzdrav]       = "https://gorzdrav.org";
PharmacySiteDomain[Pharmacy.Planetazdorovo] = "https://planetazdorovo.ru";


function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

// check if cookies file exists
async function checkCookies(pharmacy){
    const filename = `${pharmacy}_cookies.json`;
    try {
        await fs.access(filename);
        return true;
    } catch (error) {
        if (error.code === 'ENOENT') {
            return false;
        } else {
            throw error;
        }
    }
}

async function loadCookies(pharmacy){
    const filename = `${pharmacy}_cookies.json`;
    try {
        const data = await fs.readFile(filename, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        throw error;
    }
}

async function saveCookies(pharmacy, cookies){
    const filename = `${pharmacy}_cookies.json`;
    const data = JSON.stringify(cookies, null, 4);
    await fs.writeFile(filename, data, 'utf-8');
}


class MegaParser {
    constructor(){
        this.parsers = {};
        this.parsers[Pharmacy.Zdravcity]      = new ZdravcityParser();
        this.parsers[Pharmacy.AptekaRu]       = new AptekaRuParser();
        this.parsers[Pharmacy.Eapteka]        = new EAptekaParser();
        this.parsers[Pharmacy.Ozon]           = new OzonParser();
        this.parsers[Pharmacy.Gorzdrav]       = new GorzdravParser();
        this.parsers[Pharmacy.Planetazdorovo] = new PlanetazdorovoParser();
        
        this.setParserNames();
    }
    getPharmacy(url){
        for (const [pharmacy, domain] of Object.entries(PharmacySiteDomain)) {
            if(url.toLowerCase().startsWith(domain)){
                return pharmacy;
            }
        }
        return null;
    }
    pickParser(url){
        let pharmacy = this.getPharmacy(url);
        return this.parsers[pharmacy];
    }
    setParserNames(){
        for (const [pharmacy, parser] of Object.entries(this.parsers)) {
            Object.defineProperty(parser, 'PHARMACY', {
                value: pharmacy,
                writable: false, // Ensure the property is not writable
                enumerable: true, // Make the property enumerable
                configurable: false // Ensure the property can't be reconfigured or deleted
            });
        }
    }
    async parse(page, url){
        let result;
        const parser = this.pickParser(url);

        try{
            await page.goto(url, {timeout: 2*60*1000, waitUntil: 'networkidle2'});
        } catch (e) {
            return {error: Errors.OpenPageError, message: e.message}
        }
        
        try{
            result = await parser.parse(page);
        } catch (e) {
            return {error: Errors.ParseError, message: e.message}
        }
        
        return result;
    }
}

class Parser {
    PHARMACY = null;

    async parse(page){

    }
    async loadCookies(page){
        console.log(`[${this.PHARMACY}] Looking for cookies for...`);
        if(await checkCookies(this.PHARMACY)){
            console.log('Loading cookies...');
            let cookies = await loadCookies(this.PHARMACY);
            await page.setCookie(...cookies);
            console.log('Cookies loaded.');
            console.log('cookies loaded:\n', JSON.stringify(cookies, null, 4));
            cookies = await page.cookies();
            console.log('cookies page:\n', JSON.stringify(cookies, null, 4));
        } else {
            console.log('Cookies was not found');
        }
    }
    async saveCookies(page){
        console.log('Saving cookies...');
        let cookies = await page.cookies();
        saveCookies(this.PHARMACY, cookies);
        console.log('Cookies was saved.');
    }
}

class ZdravcityParser extends Parser {
    async parse(page){
        if(await this.checkBotDetection(page))
            return {bot_detected: true};

        let price = await this.parsePrice(page);
        if(price){
            return {price: price, out_of_stock: false, pharmacy: this.PHARMACY};
        } else {
            return {price: -1, out_of_stock: true, pharmacy: this.PHARMACY};
        }
    }

    async checkBotDetection(page){
        if (await this.botDetected(page)){
            //await page.reload();
            await sleep(7*1000);
        }
        return await this.botDetected(page);
    }

    async botDetected(page){
        let title = await page.title();
        return title.toLowerCase().includes('ddos');
    }

    async parsePrice(page){
        await page.locator('[class*="Price_price"]').wait();
        const raw_price = await page.evaluate(() => {
            const element = document.querySelector('[class*="Price_price"]');
            return element ? element.textContent.trim() : null;
        });

        const price_pattern = /Цена\s*([\s\d]*) ₽/
        if(!price_pattern.test(raw_price)){
            return null;
        } else {
            let price_str = price_pattern.exec(raw_price)[1];
            return Number(price_str.replace(/\s/g, ''));
        }
    }

    async parsePillName(page){
        await page.locator('h1[class*="ProductHeader_product-header-title"]').wait();
        let pill_name = await page.evaluate(() => {
            const element = document.querySelector('h1[class*="ProductHeader_product-header-title"]');
            return element ? element.textContent.trim() : null;
        });
        return pill_name;
    }
}

class AptekaRuParser extends Parser {
    async parse(page){
        if(await this.checkBotDetection(page))
            return {bot_detected: true};

        let price = await this.parsePrice(page);
        if(price){
            return {price: price, out_of_stock: false, pharmacy: this.PHARMACY};
        } else {
            return {price: -1, out_of_stock: true, pharmacy: this.PHARMACY};
        }
    }

    async checkBotDetection(page){
        if (await this.botDetected(page)){
            await page.reload();
            await sleep(5*1000);
        }
        return await this.botDetected(page);
    }

    async botDetected(page){
        let url = page.url();
        return url.includes('https://err.apteka.ru/');
    }

    async parsePrice(page){
        const price_selector = 'span[class="moneyprice__roubles"]'; 
        await page.locator(price_selector).wait();
        const raw_price = await page.evaluate((price_selector) => {
            const element = document.querySelector(price_selector);
            return element ? element.textContent.trim() : null;
        }, price_selector);
        let price;
        if(raw_price){
            price = Number(raw_price.replace(/\s/g, '').trim());
        } else {
            price = OUT_OF_STOCK;
        }
        return price;
    }
}

class EAptekaParser extends Parser {
    async parse(page){
        let price = await this.parsePrice(page);

        if(price){
            return {price: price, out_of_stock: false, pharmacy: this.PHARMACY};
        } else {
            return {price: -1, out_of_stock: true, pharmacy: this.PHARMACY};
        }
    }
    async parsePrice(page){
        const price_selector = 'span[class="offer-tools__price_num-strong"]';
        await page.waitForSelector(price_selector, {timeout: 10000});

        const raw_price = await page.evaluate((price_selector) => {
            const element = document.querySelector(price_selector);
            const price = element.getAttribute('data-price');
            return price ? price : null;
        }, price_selector);

        let price;
        if(raw_price){
            price = Number(raw_price);
        } else {
            price = null;
        }
        return price;
    }
}

class OzonParser extends Parser {
    async parse(page){
        if(await this.checkBotDetection(page))
            return {bot_detected: true};

        let price = await this.parsePrice(page);
        if(price){
            return {price: price, out_of_stock: false, pharmacy: this.PHARMACY};
        } else {
            return {price: -1, out_of_stock: true, pharmacy: this.PHARMACY};
        }
    }

    async checkBotDetection(page){
        let title = await page.title();
        if(title.toLowerCase() == 'antibot challenge page'){
            await sleep(5*1000);
        }

        if (await this.botDetected(page)){
            await page.reload();
            await sleep(6*1000);
        }
        return await this.botDetected(page);
    }

    async botDetected(page){
        let title = await page.title();
        return title.toLowerCase() == 'доступ ограничен';
    }

    async parsePrice(page){
        try{
            await page.waitForSelector('div[data-widget="webPrice"] span::-p-text(₽)', {timeout: 10000});
        } catch {
            return null;
        }
        

        const raw_price = await page.evaluate(() => {
            const elements = Array.from(document.querySelectorAll('div[data-widget="webPrice"] span'));
            const element = elements.find(element => element.innerText.includes('₽'));
            return element ? element.textContent.trim() : null;
        });
        const price_pattern = /\s*([\s\d]*)\s₽/
        if(!price_pattern.test(raw_price)){
            return null;
        } else {
            let price_str = price_pattern.exec(raw_price)[1];
            return Number(price_str.replace(/\s/g, ''));
        }

    }
}

class GorzdravParser extends Parser {
    async parse(page){
        let price = await this.parsePrice(page);
        if(price == OUT_OF_STOCK){
            return {price: -1, out_of_stock: true, pharmacy: this.PHARMACY};
        } else {
            return {price: price, out_of_stock: false, pharmacy: this.PHARMACY};
        }
    }
    async parsePrice(page){
        await page.waitForSelector('meta[itemprop="price"]', {timeout: 10000});

        const price = await page.evaluate(() => {
            const price_el = document.querySelector('meta[itemprop="price"]');
            const price = Number(price_el.getAttribute('content'));
            return price ? price : null;
        });

        return price ? price: OUT_OF_STOCK;
    }
}

class PlanetazdorovoParser extends Parser {
    async parse(page){
        if(await this.checkBotDetection(page))
            return {bot_detected: true};

        let price = await this.parsePrice(page);

        if(price){
            return {price: price, out_of_stock: false, pharmacy: this.PHARMACY};
        } else {
            return {price: -1, out_of_stock: true, pharmacy: this.PHARMACY};
        }
    }

    async checkBotDetection(page){
        if (await this.botDetected(page)){
            await page.reload();
            await sleep(5*1000);
        }
        return await this.botDetected(page);
    }

    async botDetected(page){
        let title = await page.title();
        return title == "HTTP 403";
    }

    async parsePrice(page){
        try   { await page.waitForSelector('meta[itemprop="price"]', {timeout: 10000}); }
        catch { return null; }
        
        const price = await page.evaluate(() => {
            const price_el = document.querySelector('meta[itemprop="price"]');
            const price = Number(price_el.getAttribute('content'));
            return price ? price : null;
        });
        return price;
    }
}


exports.MegaParser = MegaParser;
exports.Pharmacy = Pharmacy;
