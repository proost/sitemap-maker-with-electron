let $ = require('jquery')
require('popper.js')
require('bootstrap')

const { ipcRenderer } = require('electron')
let isLoadFile = false
let currentProgressAmount = 0

ipcRenderer.on('receiveFile', (event, msg) => {
  let fileCheckAlert = document.getElementById('file-checker')
  let textMsg = ''
  fileCheckAlert.className = ''
  switch (msg) {
    case 'no-sheet':
      fileCheckAlert.classList.add('alert', 'alert-warning')
      textMsg = '엑셀에 해당 Sheet가 없어요!'
      isLoadFile = false
      break
    case 'not-excel-file':
      fileCheckAlert.classList.add('alert', 'alert-danger')
      textMsg = '해당 파일은 엑셀 파일이 아닙니다!'
      isLoadFile = false
      break
    case 'incorrect-data-format':
      fileCheckAlert.classList.add('alert', 'alert-warning')
      textMsg = '엑셀에 데이터 포맷이 잘못되었습니다.'
      isLoadFile = false
      break
    default:
      if ( msg.includes(':') ) {
        fileCheckAlert.classList.add('alert', 'alert-success')
        textMsg = msg
        isLoadFile = true
      } else {
        fileCheckAlert.classList.add('alert', 'alert-danger')
        textMsg = '오류가 발생하였습니다'
        isLoadFile = false
      }
  }
  
  fileCheckAlert.innerText = textMsg
  $("#file-checker").alert()
})

ipcRenderer.on('changeProgressBar', (event, changeAmount) => {
  let progressBar = document.getElementsByClassName('progress-bar')[0]
  currentProgressAmount += changeAmount
  progressBar.style.width = `${currentProgressAmount}%`
})

ipcRenderer.on('processMsg', (event, msg) => {
  let tag = document.getElementById('process-msg')
  switch (msg) {
    case 'error':
      tag.classList.add('alert', 'alert-danger')
      tag.innerText = '파일 생성에 에러가 있습니다.'
      break
    case 'success':
      tag.classList.add('alert', 'alert-success')
      tag.innerText = '파일이 정상적으로 생성되었습니다. 폴더를 확인해주세요.'
      break
    default:
      console.log('impossible')
  }
  $('#end-process-msg').alert()
})

function onFileOpen() {
  ipcRenderer.send('openFile')
}

window.addEventListener('load', function() {
  let form = document.getElementsByClassName('needs-validation')[0]
  let timeoutInput = form.getElementsByClassName('form-control')[0]
  form.addEventListener('submit', (event) => {
    if ( isTimeoutValidated(timeoutInput.value) && isLoadFile) {
      if ( timeoutInput.classList.contains('is-invalid') ) {
        timeoutInput.classList.remove('is-invalid')
      }

      timeoutInput.classList.add('is-valid')
      startCrawling(timeoutInput.value)
    } else {
      event.preventDefault()
      event.stopPropagation()
      timeoutInput.classList.add('is-invalid')

      let feedbackMsg = document.getElementsByClassName('invalid-feedback')[0]
      if ( !isTimeoutValidated(timeoutInput.value) ) {
        feedbackMsg.innerText = '0보다 큰 정수값을 입력해주세요'
      } else if ( !isLoadFile ) {
        feedbackMsg.innerText = '파일을 선택에 오류가 있습니다.'
      }
    }
  }, false)
}, false)

function isTimeoutValidated(timeoutSetting) {
  let filterInt = function (value) {
    if( /^(\-|\+)?([0-9]+|Infinity)$/.test(value) && Number(value) > 0)
      return true
    return false
  }
  return filterInt(timeoutSetting)
}

function startCrawling(timeoutSetting) {
  ipcRenderer.send('startCrawling', timeoutSetting)
}