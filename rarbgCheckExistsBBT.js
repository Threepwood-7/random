// ==UserScript==
// @name         rarbgCheckExistsBBT
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  check against BBT and the 'Everything' search tool if you already have the file
// @author       You
// @match        https://rarbgmirror.org/torrents.php?*search=*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=rarbgmirror.org
// @require      http://ajax.googleapis.com/ajax/libs/jquery/2.1.0/jquery.min.js
// @grant GM_xmlhttpRequest
// ==/UserScript==

(function() {
    'use strict';

    const bbt_apiKey = "";
    const bbt_downloads = { loaded: false };

    function page_updateStatus() {
        const resultRows = jQuery("tr.lista2");

        resultRows.each(function(i, val) {
            const row = resultRows[i];
            const a1 = jQuery(row).find("a")[1];
            const a1j = jQuery(a1);
            const a1text = a1j.text();

            if (allFounds[a1text]) return;

            findByName({
                name: a1text,
                onfind: function(largestItem) {
                    console.log("Item found", a1text, largestItem);

                    if (largestItem.RemovedTorrent) {
                        // this was found in Everything, but not in BBT, so it's a torrent that got archived and removed from BBT (as soon as you save *all* .torrent files in some folder)
                        jQuery(row).children("td,th").css("background-color", "#ABB2B9");
                    } else if (largestItem.Downloaded > 0 && largestItem.Downloaded === largestItem.Size) {
                        // we have a 100% downloaded file in BBT, background color is light green
                        jQuery(row).children("td,th").css("background-color", "#D4EFDF");
                        jQuery(row).attr("title", largestItem.Torr.InfoHash + " " + largestItem.Torr.DisplayName);

                        allFounds[a1text] = true;

                    } else {
                        // we have download progress, but not 100%, so let's show its progress in the page row
                        jQuery(row).children("td,th").css("background-color", "#F6DDCC");
                        jQuery(row).attr("title", largestItem.Torr.InfoHash + " " + largestItem.Torr.DisplayName);

                        // let's show the download progress in the page row
                        const spanId = "tm-sp-" + i;
                        let aT1 = document.getElementById(spanId);
                        if (!aT1) {
                            aT1= document.createElement("span");
                            aT1.id = spanId;
                        }

                        aT1.innerText = " P " + (largestItem.Downloaded / largestItem.Size).toFixed(2) + "%";
                        a1.parentElement.appendChild(aT1);
                    }
                }
            });
        });
    }

    function bbt_listAllDownloads() {
        const _url = `http://127.0.0.1:6906/?apiKey=${bbt_apiKey}&method=listdownloads`;

        GM_xmlhttpRequest({
            method: "GET",
            url: _url,
            onload: function(response) {
                bbt_downloads.loaded = true;
                bbt_downloads.results = JSON.parse(response.responseText);
                console.log(`Loaded ${bbt_downloads.results.length} results from BBT`);

                page_updateStatus();
            }});
    }

    function bbt_findLargestItem(torrContent) {
        let largestItem = { Size: -1 };
        for (let k = 0; k < torrContent.length; k++) {
            const item = torrContent[k];

            if (item.Size > largestItem.Size) {
                largestItem = item;
            }
        }

        return largestItem;
    }

    function sNormalize(s) {
        return s
            .replace(/\s+/g, " ")
            .replace(/\[rarbg\]/g, "").replace(/\[rbg\]/g, "")
            .replace(/\[rarbg\.to\]/g, "").replace(/\[rbg\.to\]/g, "")
            .replace(/\[rartv\]/g, "").replace(/\[rartv\.to\]/g, "")
            .replace(/\[N1C\]/g, "").replace(/\[XvX\]/g, "").trim();
    }

    function sCompareRarbg(s1, s2) {
        // as the torrent name adds a suffix, let's just compare if the html name is contained in the torrent name
        //console.log("Comparing [ %s ] vs [ %s ]", s1, s2);
        let _s1 = s1.toLowerCase().replace(/\./g, "").replace(/\-/g, "").trim();
        let _s2 = s2.toLowerCase().replace(/\./g, "").replace(/\-/g, "").trim();

        return _s2.indexOf(_s1) >= 0;
    }

    function findByName(o) {
        let foundInBBT = false;

        // first pass, let's look for a match by name
        for (let k = 0; k < bbt_downloads.results.length; k++) {
            const res = bbt_downloads.results[k];

            if (sCompareRarbg(o.name, res.DisplayName)) {
                console.log(`Found hashId ${res.InfoHash} for name [${o.name}] - name match`);
                foundInBBT = true;

                const _url = `http://127.0.0.1:6906/?apiKey=${bbt_apiKey}&method=listfiles&hash=${res.InfoHash}`;

                GM_xmlhttpRequest({
                    method: "GET",
                    url: _url,
                    onload: function(response) {
                        const torrContent = JSON.parse(response.responseText);
                        const largestItem = bbt_findLargestItem(torrContent);

                        largestItem.Torr = res;

                        o.onfind(largestItem);
                    }});

                break;
            }
        }

        // lastly, let's see if we have a .torrent file we previously downloaded but removed from BBT, so to avoid re-downloading it
        if (!foundInBBT) {
            // not found in BBT, check in Everything if there's a file
            const _url = `http://localhost:8097/?search=${encodeURIComponent(o.name)}&j=1&path_column=1`;

            GM_xmlhttpRequest({
                method: "GET",
                url: _url,
                onload: function(response) {
                    const rezz = JSON.parse(response.responseText);

                    for (let j = 0; j < rezz.results.length; j++) {
                        let res = rezz.results[j];

                        if (res.name.indexOf(".torrent") > 0) {
                            o.onfind({ RemovedTorrent: true });
                        }

                        break;
                    }
                }
            });
        }
    }

    const allFounds = {};
    let alreadyInt = false;

    function page_addLinks() {
        const resultRows = jQuery("tr.lista2");

        resultRows.each(function(i, val) {
            const row = resultRows[i];
            const a1 = jQuery(row).find("a")[1];
            const a1j = jQuery(a1);
            const a1text = a1j.text();

            const aT1 = document.createElement("a");
            aT1.innerText = " BTD ";
            aT1.target = "_blank";
            aT1.href = "https://btdig.com/search?q=" + encodeURIComponent(a1j.text());

            const aT2 = document.createElement("a");
            aT2.innerText = " S ";
            aT2.target = "_blank";
            aT2.href = "http://localhost:8097/?search=" + encodeURIComponent(a1j.text());

            const aT3 = document.createElement("a");
            aT3.innerText = " SN1 ";
            aT3.target = "_blank";
            aT3.href = "https://nzbgeek.info/geekseek.php?&browseincludewords=" + encodeURIComponent(sNormalize(a1j.text()));

            const aT4 = document.createElement("a");
            aT4.innerText = " SN2 ";
            aT4.target = "_blank";
            aT4.href = "https://nzbfinder.ws/search?search=" + encodeURIComponent(sNormalize(a1j.text()));

            a1.parentElement.appendChild(aT2);
            a1.parentElement.appendChild(aT1);
            a1.parentElement.appendChild(aT3);
            a1.parentElement.appendChild(aT4);
        });
    }

    document.addEventListener(
        "mousedown",
        function() {
            if (!alreadyInt) {
                alreadyInt = true;
                setInterval(bbt_listAllDownloads, 8000);
            }
        }
    );

    page_addLinks();
    bbt_listAllDownloads();

})();
