const small ="1-0nNGD1zcDd2t17dCR1HmVMtaQIwO60h"


// by default the maxhits is just 1, and time to live is a couple of minutes
const maxHits = 4
const timeToLive = 5 * 60
const id = small

const testMethods = () => {

  // get some test data
  const blob = DriveApp.getFileById(small).getBlob()
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
