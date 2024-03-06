# Puppeteer Scraper Example

Запуск программы:
```bash
node .\scrape.js
```

Вывод программы
```
proxyUrl: socks5://85.15.65.70:1080

Лекарство: Витажиналь капсулы 430мг 30шт
Цена: 1387

Лекарство: Витажиналь Инозит порошок для приг. раствора для приема внутрь саше 5,5г 30шт
Цена: 1691

Лекарство: Дуожиналь капсулы 400мг 20шт
Цена: Нет в наличии

Лекарство: Фамвиталь Смарт капсулы жемчужно-красные 996мг+жемчужно-черные 992мг 90шт
Цена: 3350

Лекарство: Лактожиналь капсулы ваг. 14шт
Цена: 1180
```


Зависимости:
```json
{
  "dependencies": {
    "puppeteer": "^22.4.0",
    "puppeteer-extra": "^3.3.6",
    "puppeteer-extra-plugin": "^3.2.3",
    "puppeteer-extra-plugin-stealth": "^2.11.2",
    "puppeteer-page-proxy": "^1.3.0",
    "socks-proxy-agent": "^8.0.2"
  }
}
```