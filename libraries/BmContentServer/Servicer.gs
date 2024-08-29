const Servicer = {
  get serviceUrls() {
    return {
      dev: "https://script.google.com/macros/s/AKfycbyvYE0Uh0ewHgLlZkKoV78rDHk8rk5UU47_OO_fr5Q/dev",
      exec: "https://script.google.com/macros/s/AKfycbzC9uU9IHqxpm8N7pQOT14IB_-FgUMyid3y-QXy0aGPQjumohqG78GJuRs_BAxR1sQ/exec"
    }
  },

  getServiceUrl ({ mode = "exec" } = {}) {
    const u = this.serviceUrls[mode]
    if (!u) throw `service url for ${mode} doesnt exist`
    return  u
  }  
}

