const { formToJSON } = require("axios");
const axios = require("axios");
const fetch = require('node-fetch');
let urlBase1 = "http://www.mako.co.il"
let urlBase = urlBase1+"/"
let url = urlBase + "mako-vod-index?type=service";

let settings = { method: "Get" };
let __properties = { 'consumer':'android4', 'appId':'0c4f6ec6-9194-450e-a963-e524bb6404g2', 'appVer':'3.0.3' }
fetch(url, settings)
    .then(res => res.json())
        .then((json) => {
            for (i in json.root.allPrograms)
            {
                console.log(urlBase1 + json.root.allPrograms[i].url+"?type=service");
                fetch(urlBase1 + json.root.allPrograms[i].url+"?type=service", settings)
                .then(res => res.json())
                .then((json) => {
                    for(s in json.root.programData.seasons)
                    {
                        fetch(urlBase1 + json.root.programData.seasons[s].url+"?type=service", settings)
                        .then(res => res.json())
                            .then((json) => {
                                for(v in urlBase + json.root.programData.seasons[s].vods)
                                {
                                    if(!json.root.programData.seasons[s].vods[v])
                                    {
                                        continue;
                                    }
                                    fetch(urlBase1 + json.root.programData.seasons[s].vods[v].link+'&consumer=' + __properties.consumer + "&type=service", settings)
                                    .then(res => res.json())
                                    .then(json => {
                                        let vcmid = json.root.video.guid;
                                        let videoChannelId = json.root.video.chId;
                                        episodeUrl = "http://www.mako.co.il/VodPlaylist?vcmid="+vcmid+"&videoChannelId="+videoChannelId
                            
                                        console.log(episodeUrl)
                                        
                                        fetch(urlBase1 + json.root.video.url+"&type=service", settings)
                                        .then(res => res.json())
                                        .then(json => {
                                            fetch(urlBase1 + json.root.video.url, settings)
                                            .then(res => res.text())
                                            .then(body => {
                                                console.log(body);
                                            });
                                        });
                                    });
                                    //break
                                }  
                        });
                        break  
                    }
                });
                break;
            }
        }
    );
/* http://www.mako.co.il/mako-vod-keshet/hafuch*/