'use strict'
const fs = require('fs').promises;
const { spawn } = require('child_process');

const axios = require('axios');
const proxyChain = require('proxy-chain');
const puppeteer = require('puppeteer');

const {MegaParser, Pharmacy} = require('./parsers');

require('dotenv').config();


const PROXY = {
    ip: process.env.PROXY_HOST, 
    port: process.env.PROXY_PORT,
    login: process.env.PROXY_LOGIN,
    password: process.env.PROXY_PASSWORD
};

let USE_PROXY = process.env.USE_PROXY == 1;

let REAL_PROXY_URL = null
let PROXY_URL = null;
if(PROXY.ip && PROXY.port && PROXY.login && PROXY.password){
    REAL_PROXY_URL = `http://${PROXY.login}:${PROXY.password}@${PROXY.ip}:${PROXY.port}`;
} else if (PROXY.ip && PROXY.port) {
    REAL_PROXY_URL = `http://${PROXY.ip}:${PROXY.port}`;
}

const CHROME_EXE = puppeteer.executablePath();
const DEBUGGING_PORT = process.env.DEBUGGING_PORT ? process.env.DEBUGGING_PORT : 9222;

const WINDOWS_HEADERS = {
    'Sec-Ch-Ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
}


async function fetchChromeData(port=DEBUGGING_PORT) {
    try {
        const response = await axios.get(`http://127.0.0.1:${port}/json/version`);
        return response.data;
    } catch (error) {
        return null;
    }
}

async function sendData(pharmacy, medicine, price){
    let url = `https://6feeds.ru/test_pharmacies?pharmacy=${pharmacy}&medicine=${medicine}&price=${price}`;
    try {
        const response = await axios.get(url);
        console.log('Sent to server!o');
    } catch (error) {
        console.error(error);
    }
}

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

function startChrome(debugging_port, options){
    let args = [`--remote-debugging-port=${debugging_port}`, '--accept-lang=ru-RU,ru,en-US,en'];
    if(options?.headless){
        if(options.headless == true)        args.push('--headless');
        else if (options.headless == 'new') args.push('--headless=new');
    }
    if(options?.incognito  ) args.push('--incognito');
    if(options?.ua         ) args.push(`--user-agent=${options.ua}`);
    if(options?.userDataDir) args.push(`--user-data-dir=${options.userDataDir}`);
    if(options?.proxy      ) args.push(`--proxy-server=${options.proxy}`);
    if(options?.startUrl   ) args.push(options.startUrl);

    console.log('Chrome args:', args);
    const chromeProcess = spawn(CHROME_EXE, args);
    return chromeProcess;
}


async function getUA(page){
    const userAgent = await page.evaluate(() => navigator.userAgent);
    return userAgent;
}

async function getLanguages(page){
    const languages = await page.evaluate(() => navigator.languages);
    return languages;
}

async function getPlugins(page){
    const plugins = await page.evaluate(() => navigator.plugins);
    return plugins;
}

async function getWebdriver(page){
    const webdriver = await page.evaluate(() => navigator.webdriver);
    return webdriver;
}


(async () => {
    let data = await fetchChromeData(DEBUGGING_PORT);
    if(data){console.error("[ERROR] Some Chrome instance is already running with same debugging port. Kill it first!\nNote: you can use 'pkill chrome' for that."); return -1}

    if(USE_PROXY){
        PROXY_URL = await proxyChain.anonymizeProxy(REAL_PROXY_URL);
        console.log(`USE_PROXY: true\nProxy forward: ${PROXY_URL} -> ${REAL_PROXY_URL}`)
    }

    let options = {
        ua: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        headless: 'new',
        startUrl: 'https://planetazdorovo.ru',
        userDataDir: 'chrome_dir',
        proxy: PROXY_URL
    }
    
    let webSocketDebuggerUrl;
    startChrome(DEBUGGING_PORT, options);
    while(true){
        let data = await fetchChromeData(DEBUGGING_PORT);
        if(!data) continue;
        webSocketDebuggerUrl = data.webSocketDebuggerUrl;
        break;
    }

    if(options?.startUrl){
        let wait_for = 10;
        console.log(`Waiting for ${wait_for} seconds before connecting...`);
        await sleep(wait_for*1000);
    }
    console.log('Connecting to browser...');
    const browser = await puppeteer.connect({
        browserWSEndpoint: webSocketDebuggerUrl
    }); console.log('Connected to browser!');

    const page_linux = (await browser.pages())[0];

    const page_windows = await browser.newPage();
    await page_windows.setExtraHTTPHeaders(WINDOWS_HEADERS);

    let megaparser = new MegaParser();

    let file_data = await fs.readFile('pills.json', 'utf-8') 
    let pills = JSON.parse(file_data);

    for(const pill of pills){
        console.log(pill.name);
        for(const url of pill.urls){
            let pharmacy = megaparser.getPharmacy(url);
            //if(skipPharmacyList.includes(pharmacy)) continue;
            
            let page;
            if(pharmacy == Pharmacy.Eapteka)
                page = page_windows;
            else
                page = page_linux;

            
            let result = await megaparser.parse(page, url);
            
            if(result?.bot_detected){
                console.log(pharmacy, 'bot detected!');
                continue;
            }
            if(result?.error){
                console.log(pharmacy, `[${result.error}] ${result.message}`);
                continue;
            }

            let price = result?.price;

            console.log(pharmacy, price);
            await sendData(pharmacy, pill.name, price);
        }
    }

    //await page.screenshot({path: 'connect_puppy.png'});
    // console.log('UA:', await getUA(page));
    // console.log('langs:', await getLanguages(page));
    // console.log('plugins:', await getPlugins(page));
    // console.log('webdriver:', await getWebdriver(page));

    //await sleep(10*60*1000);
    await browser.close();
    if (USE_PROXY)
        await proxyChain.closeAnonymizedProxy(PROXY_URL, true);
})();
