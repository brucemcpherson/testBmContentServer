

const helloWorld = () => {

  const link = Exports.ContentServe.toCache({
    content: 'hello world',
    accessToken: ScriptApp.getOAuthToken()
  })

  // tnis link can be used only once and will expire after a short time
  // you can use it from the browser, to feed a webapp, serverapp - whatever
  console.log(link)

}

const probeInfo = () => {

  const link = Exports.ContentServe.toCache({
    content: 'hello world',
    accessToken: ScriptApp.getOAuthToken(),
    probeInfo: {
      name: "hello world",
      foo: "bar"
    }
  })

  // tnis link can be used only once and will expire after a short time
  // you can use it from the browser, to feed a webapp, serverapp - whatever
  console.log(link)

}

const fileContent = () => {

  const small = "1-0nNGD1zcDd2t17dCR1HmVMtaQIwO60h"
  const content = DriveApp.getFileById(small).getBlob().getDataAsString()

  const link = Exports.ContentServe.toCache({
    content,
    accessToken: ScriptApp.getOAuthToken()
  })

  // tnis link can be used only once and will expire after a short time
  // you can use it from the browser, to feed a webapp, serverapp - whatever
  console.log(link)

}

const jsonContent = () => {

  const json = "1NYaGGZZXDCnBkxBKz9P0HmTRkbJfMq2r"
  const content = DriveApp.getFileById(json).getBlob().getDataAsString()

  const link = Exports.ContentServe.toCache({
    content,
    accessToken: ScriptApp.getOAuthToken(),
    serveAs: "JSON"
  })

  // tnis link can be used only once and will expire after a short time
  // you can use it from the browser, to feed a webapp, serverapp - whatever
  console.log(link)

}


const moreHits = () => {

  const json = "1NYaGGZZXDCnBkxBKz9P0HmTRkbJfMq2r"
  const content = DriveApp.getFileById(json).getBlob().getDataAsString()

  const link = Exports.ContentServe.toCache({
    content,
    accessToken: ScriptApp.getOAuthToken(),
    serveAs: "JSON",
    maxHits: 10,
    timeToLive: 5 * 60
  })

  // tnis link can be used only once and will expire after a short time
  // you can use it from the browser, to feed a webapp, serverapp - whatever
  console.log(link)

}

/* 
  soak results
	{ bad: 0,
  good: 340,
  wrong: 0,
  missing: 0,
  attempts: 340,
  maxlinkMs: 362,
  minlinkMs: 129,
  totallinkMs: 50011,
  avglinkMs: 147,
  maxfetchMs: 16819,
  minfetchMs: 2588,
  totalfetchMs: 1215097,
  avgfetchMs: 3574 }
*/
const soak = () => {
  const SOAKS = 340
  const results = {
    bad: 0,
    good: 0,
    wrong: 0,
    missing: 0,
    attempts: 0,
    maxlinkMs: 0,
    minlinkMs: Infinity,
    totallinkMs: 0,
    avglinkMs: 0,
    maxfetchMs: 0,
    minfetchMs: Infinity,
    totalfetchMs: 0,
    avgfetchMs: 0
  }


  for (let i = 0; i < SOAKS; i++) {
    const content = new Date().getTime().toString()
    const maxHits = Math.round (Math.random ()/ 2 + 1)
    const timeToLive = Math.ceil (Math.random() * 60 ) +30
    const delay = Math.round (Math.random() * 1000) + 1000
    
    results.attempts++
    let start = new Date().getTime()
    const link = Exports.ContentServe.toCache({
      content,
      accessToken: ScriptApp.getOAuthToken(),
      maxHits,
      timeToLive,
    })
    let elapsed = new Date().getTime() - start
    results.minlinkMs = Math.min (results.minlinkMs, elapsed) 
    results.maxlinkMs = Math.max (results.maxlinkMs, elapsed) 
    results.totallinkMs += elapsed 
    results.avglinkMs = Math.round (results.totallinkMs / results.attempts)
    start = new Date().getTime()
    const resp = UrlFetchApp.fetch(link, {
      muteHttpExceptions: true
    })

    elapsed = new Date().getTime() - start
    results.minfetchMs = Math.min (results.minfetchMs, elapsed) 
    results.maxfetchMs = Math.max (results.maxfetchMs, elapsed) 
    results.totalfetchMs += elapsed 
    results.avgfetchMs = Math.round (results.totalfetchMs / results.attempts)

    const status = resp.getResponseCode()
    const text = resp.getContentText()
    if (status !== 200) {
      results.bad++
      console.log('bad status', status)
    }
    if (text !== content) {
      results.wrong ++
      console.log('wrong content', text, content)
    }
    if (!text) {
      results.missing ++
      console.log('missing content', timeToLive)
    }

    if (text === content) {
      results.good++
    }

    if (!(results.attempts % 20)) {
      console.log(results)
    }
    Utilities.sleep (delay)
  }
  console.log (results)
}



const testMethods = () => {

  const small = "1-0nNGD1zcDd2t17dCR1HmVMtaQIwO60h"

  // by default the maxhits is just 1, and time to live is a couple of minutes
  const maxHits = 4
  const timeToLive = 5 * 60
  const id = small

  // get some test data
  const blob = DriveApp.getFileById(id).getBlob()
  const content = blob.getDataAsString()

  // provide some optional probe info if a probe request is ever called
  // stuff that might be useful for debugging can go here, or maybe nothing at all
  const probeInfo = {
    name: blob.getName(),
    foo: "bar",
    hello: "world",
    contentType: blob.getContentType(),
    timestamp: new Date().getTime()
  }

  // use the dev version of the serviceUrl
  const devService = false

  //an accesstoken to be used in the second phase
  const accessToken = ScriptApp.getOAuthToken()

  const urlat = Exports.ContentServe.toCache({
    probeInfo,
    maxHits,
    content,
    timeToLive,
    accessToken,
    devService
  })

  // do a fetch
  const getter = (url, isProbe = false) => {
    console.log('...fetching', url)
    // if we are using the /dev endpoint we need to be authorized
    // not so for the normal /exec deployment
    const headers = devService ? {
      Authorization: `Bearer ${accessToken}`
    } : {}

    const resp = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      headers
    })
    const status = resp.getResponseCode()
    const text = resp.getContentText()
    console.log("fetch status", status)

    if (isProbe) {
      try {
        return text && JSON.parse(text)
      } catch (err) {
        console.log(err)
        return text
      }
    } else {
      return text
    }

  }

  console.log(getter(urlat + "&probe=yes"))
  console.log(getter(urlat))
}
