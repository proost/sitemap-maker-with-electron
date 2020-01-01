const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const xlsx = require('xlsx')
const axios = require('axios')
const cheerio = require('cheerio')
const xmlbuilder = require('xmlbuilder')
const fs = require('fs')

let mainWindow
let siteList = []
let siteMap = {}
let timeInterval
let progress = 0
let timer
let isEnd = false

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
    }
  });
  
  mainWindow.loadURL(`file://${__dirname}/index.html`)
}

ipcMain.on('openFile', (event, arg) => {
  dialog.showOpenDialog(mainWindow, {
    properties: ['openFile']
  }).then((fileObj) => {
    let operationMessage = readFile(fileObj.filePaths[0])
    event.reply('receiveFile', operationMessage)
  })
})

ipcMain.on('startCrawling', (event, timeoutSetting) => {
  startCrawling()
  countTime(timeoutSetting)
})

ipcMain.on('changeOkay', (event, arg) => {console.log('')})

function readFile(filePath) {
  // check file 
  if (filePath.endsWith('.xlsx') || filePath.endsWith('.xls')) {
    const workBook = xlsx.readFile(filePath)
    const rowObj = xlsx.utils.sheet_to_json(workBook.Sheets['Sheet1'])
    if (!rowObj.length) {
      //no sheet
      return 'alert-warning'
    }
    // read file
    for(let i=0; i<rowObj.length; i++) {
      siteList.push(rowObj[i]["사이트 주소"])
    }
    return 'alert-success'
  } else {
    // not excel file
    return 'alert-danger'
  }
}

function startCrawling() {
  //initialize sitemap list
  for(let i=0; i<siteList.length; i++) {
    let mainUrl = ''
    if ( siteList[i].startsWith('http://') ) {
      mainUrl = siteList[i].replace('http://', 'https://')
    } else {
      mainUrl = siteList[i]
    }
    siteMap[mainUrl] = []
    siteMap[mainUrl].push(mainUrl)
  }
  
  //real start crawling
  for(let i=0; i<siteList.length; i++) {
    collectSites(siteList[i])
  }
}

async function collectSites(mainUrl) {
  for(let i=0; i<siteMap[mainUrl].length; i++) {
    if (isEnd) {
      break
    }
    let htmlText = await getHtml(siteMap[mainUrl][i])
    if (htmlText !== null) {
      let tagObjectArr = parseHtml(htmlText)
      for(let i=0; i<tagObjectArr.length; i++) {
        let tempList = Array.from(shakeOffSites(tagObjectArr[i], mainUrl))
        siteMap[mainUrl] = siteMap[mainUrl].concat(tempList) 
      }
    }
  }
}

async function getHtml(url) {
  try {
    return await axios.get(url)
  } catch (error) {
    return null
  }
}

function parseHtml(htmlText) {
  const $ = cheerio.load(htmlText.data)
  const tagList = ['a', 'area']
  let tagObjectArr = []
  for(let i=0; i<tagList.length; i++) {
    tagObjectArr.push($(tagList[i]))
  }
  return tagObjectArr
}

function shakeOffSites(tagObject, mainUrl) {
  let tempList = new Set()
  for(let key in tagObject) {
    let hrefAttribute = tagObject[key]['attribs']
    if (hrefAttribute !== undefined) {
      if (hrefAttribute.href !== undefined && hrefAttribute.href.startsWith('/')) {
        tempList.add(mainUrl + hrefAttribute.href)
      }
    }
  }
  return tempList
}

function countTime(timeoutSetting) {
  //분 * 초 * ms / 100 progressBar를 채워넣는 시간
  timeInterval = (timeoutSetting * 60) * 1000 / 100
  timer = setInterval(progressTimer, timeInterval)
}

function progressTimer() {
  //ms를 제거
  if (progress > 100) {
    endProgress()
  }
  mainWindow.webContents.send('changeProgressBar', timeInterval / 1000)
  mainWindow.setProgressBar(timeInterval / 1000)
  progress += (timeInterval / 1000 )
}

function endProgress() {
  isEnd = true
  clearInterval(timer)
  for(let mainUrl in siteMap) {
    const xml = buildXml(mainUrl)
    saveFile(mainUrl, xml)
  }
}

function buildXml(mainUrl) {
  const rootObj = {
    urlset: {
      'xsi:schemaLocation': 'http://www.sitemaps.org/schemas/sitemap/0.9 http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd',
      'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
      'xmlns': 'http://www.sitemaps.org/schemas/sitemap/0.9'
    }
  }
  let root = xmlbuilder.create(rootObj)
  const nowStr = getNow()
  for(let i=0; i<siteMap[mainUrl].length; i++) {
    let urlTag = root.ele('url')
    urlTag.ele('loc', {}, siteMap[mainUrl][i])
    urlTag.ele('lastmod', {}, nowStr)
  }
  return root.end( {pretty: true} )
}

function getNow() {
  let today = new Date()
  let year = today.getFullYear()
  let month = String(today.getMonth() + 1).padStart(2, '0')
  let day = String(today.getDate()).padStart(2, '0')
  let hour = today.getHours()
  let min = today.getMinutes()
  let sec = today.getSeconds()
  return `${year}-${month}-${day}T${hour}:${min}:${sec}`
}

function saveFile(mainUrl, xml) {
  const fileName = nameFile(mainUrl)
  fs.writeFile(`${fileName}.xml`, xml, (error) => {
    if (error) {
      mainWindow.webContents.send('raiseFileMakeError')
    }
  })
}

function nameFile(mainUrl) {
  const re = /\/\/\w+\./gi
  let host = mainUrl.match(re)[0]
  return host.replace('//','').replace('.','')
}

app.on('ready', createWindow)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

