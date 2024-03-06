'use strict'
const puppeteer = require('puppeteer');
const puppeteerExtra = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const SocksProxyAgent = require('socks-proxy-agent');
const fetch = require('node-fetch');

puppeteerExtra.use(StealthPlugin());


const ZDRAVCITY_URLS = [
    "https://zdravcity.ru/p_vitazhinal-kaps-430mg-n30-bad-0094795.html",
    "https://zdravcity.ru/p_vitazhinal-inozit-poroshok-dlja-prig-rastvora-dlja-priema-vnutr-sashe-5-5g-30sht-0184110.html",
    "https://zdravcity.ru/p_duozhinal-kapsuly-400mg-20sht-0190811.html",
    "https://zdravcity.ru/p_famvital-smart-kapsuly-zhemchuzhno-krasnye-996mg-zhemchuzhno-chernye-992mg-90sht-0203314.html",
    "https://zdravcity.ru/p_laktozhinal-kaps-vag-n14-0001396.html"
]

/**
 * Функция делает API запрос на сервис proxylist.geonode.com для получения 
 * списка бесплатных прокси-серверов
 * @return {{ip: string, port: number}}
 */
async function getAvailableProxy(){
    const proxyApiUrl = 'https://proxylist.geonode.com/api/proxy-list?country=RU&protocols=socks5&filterLastChecked=10&limit=1&page=1&sort_by=upTime&sort_type=desc';
    const response = await fetch(proxyApiUrl);
    const data = await response.json();
    return {ip: data['data'][0]['ip'], port: data['data'][0]['port']};
};

/**
 * Функция возвращает название лекарства, полученного на странице
 * @param {puppeteer.Page} page
 * @return {string} 
 */
async function parsePillName(page){
    let pill_name = await page.evaluate(() => {
        const element = document.querySelector('h1[class*="ProductHeader_product-header-title"]');
        return element ? element.textContent.trim() : null;
    });
    return pill_name;
}

/**
 * Функция возвращает цену лекарства, полученного на странице
 * @param {puppeteer.Page} page
 * @return {number}
 */
async function parsePrice(page){
    const raw_price = await page.evaluate(() => {
        const element = document.querySelector('[class*="Price_price"]');
        return element ? element.textContent.trim() : null;
    });

    const price_pattern = /Цена\s*([\s\d]*) ₽/
    if(!price_pattern.test(raw_price)){
        return "Нет в наличии";
    } else {
        let price_str = price_pattern.exec(raw_price)[1];
        return Number(price_str.replaceAll(' ', ''));
    }
}

(async () => {
    const proxy = await getAvailableProxy();
    const proxyUrl = `socks5://${proxy.ip}:${proxy.port}`
    console.log('proxyUrl:', proxyUrl);

    const browser = await puppeteerExtra.launch({
        args: [
            `--no-sandbox`,
            `--disable-setuid-sandbox`,
            `--proxy-server=${proxyUrl}`
        ],
        headless: true
    });

    const page = await browser.newPage();

    for(let url of ZDRAVCITY_URLS){
        await page.goto(url);
        let pill_name = await parsePillName(page);
        let price = await parsePrice(page);
        console.log(`Лекарство: ${pill_name}\nЦена: ${price}\n`);
    }

    await browser.close();
})();