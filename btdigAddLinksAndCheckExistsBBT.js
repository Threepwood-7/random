// ==UserScript==
// @name         btdigAddLinksAndCheckExistsBBT
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Add torrent and magnet links to btdig search results
// @author       You
// @match        https://btdig.com/search?*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=btdig.com
// @require      http://ajax.googleapis.com/ajax/libs/jquery/2.1.0/jquery.min.js
// @grant GM_xmlhttpRequest
// ==/UserScript==

(function() {
    'use strict';

    document.getElementById("q").style.width = window.innerWidth - 200;
    document.getElementsByTagName("div")[1].style.maxWidth = window.innerWidth - 100;
    jQuery(".torrent_size").css("font-size", "x-large");

    const bbt_apiKey = "";
    const bbt_downloads = { loaded: false };

    function page_updateStatus() {
        const resultRows = jQuery("div.one_result");

        resultRows.each(function(i, val) {
            const row = resultRows[i];
            const a1 = jQuery(row).find("a")[0];
            const a1j = jQuery(a1);
            const a1text = a1j.text();
            const hrefInfoHash = a1.href.substring(a1.href.indexOf(".com/") + 5, a1.href.indexOf(".com/") + 5 + 40);

            if (allFounds[hrefInfoHash]) return;

            findByName({
                name: a1text,
                infoHash: hrefInfoHash,
                onfind: function(largestItem) {
                    console.log("Item found", a1text, hrefInfoHash, largestItem);

                    if (largestItem.RemovedTorrent) {
                        // this was found in Everything, but not in BBT, so it's a torrent that got archived and removed from BBT (as soon as you save *all* .torrent files in some folder)
                        jQuery(row).css("background-color", "#ABB2B9");
                    } else if (largestItem.Downloaded > 0 && largestItem.Downloaded === largestItem.Size) {
                        // we have a 100% downloaded file in BBT, background color is light green
                        jQuery(row).css("background-color", "#D4EFDF");
                        jQuery(row).attr("title", largestItem.Torr.InfoHash + " " + largestItem.Torr.DisplayName);

                        allFounds[hrefInfoHash] = true;

                        if (largestItem.PartialNameMatch) { // found in BBT, but just with a partial name match
                            jQuery(row).css("font-style", "italic");
                        }
                    } else {
                        // we have download progress, but not 100%, so let's show its progress in the page row
                        jQuery(row).css("background-color", "#F6DDCC");
                        jQuery(row).attr("title", largestItem.Torr.InfoHash + " " + largestItem.Torr.DisplayName);

                        if (largestItem.PartialNameMatch) { // found in BBT, but just with a partial name match
                            jQuery(row).css("font-style", "italic");
                        }

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

    function sCompare(s1, s2) {
        //console.log("Comparing [ %s ] vs [ %s ]", s1, s2);
        let _s1 = s1.toLowerCase().replace(/\./g, "").replace(/\-/g, "").trim();
        let _s2 = s2.toLowerCase().replace(/\./g, "").replace(/\-/g, "").trim();

        return _s1.indexOf(_s2) >= 0 || _s2.indexOf(_s1) >= 0;
    }

    function findByName(o) {
        let foundInBBT = false;

        // first pass, let's look for an exact match by infoHash
        for (let k = 0; k < bbt_downloads.results.length; k++) {
            const res = bbt_downloads.results[k];

            if (res.InfoHash.toLowerCase() === o.infoHash.toLowerCase()) {
                console.log(`Found hashId ${res.InfoHash} for name [${o.name}] - exact match`);
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

        // second pass, let's look for a partial name match
        for (let k = 0; k < bbt_downloads.results.length; k++) {
            const res = bbt_downloads.results[k];

            if (res.InfoHash.toLowerCase() !== o.infoHash.toLowerCase() &&
                sCompare(res.DisplayName, o.name)) {
                console.log(`Found hashId ${res.InfoHash} for name [${o.name}] - name match only`);
                foundInBBT = true;

                const _url = `http://127.0.0.1:6906/?apiKey=${bbt_apiKey}&method=listfiles&hash=${res.InfoHash}`;

                GM_xmlhttpRequest({
                    method: "GET",
                    url: _url,
                    onload: function(response) {
                        const torrContent = JSON.parse(response.responseText);
                        const largestItem = bbt_findLargestItem(torrContent);

                        largestItem.Torr = res;
                        largestItem.PartialNameMatch = true;

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

        function page_addLinksMagnet(href, hrefIH) {
            let aT1 = document.createElement("a");
            aT1.innerText = " T1 ";
            aT1.target = "_blank";
            aT1.href = "https://itorrents.org/torrent/" + hrefIH.toLowerCase() + ".torrent";

            let aT2 = document.createElement("a");
            aT2.innerText = " T2 ";
            aT2.target = "_blank";
            aT2.href = "https://torrage.info/torrent.php?h=" + hrefIH.toUpperCase();

            let aT3 = document.createElement("a");
            aT3.innerText = " T3 ";
            aT3.target = "_blank";
            aT3.href = "https://btcache.me/torrent/" + hrefIH.toUpperCase();

            let aM = document.createElement("a");
            aM.innerText = " M ";
            aM.href = "data:text," + href.href;
            aM.download = "" + hrefIH + ".magnet";

            href.parentElement.appendChild(aT1);
            href.parentElement.appendChild(aT2);
            href.parentElement.appendChild(aT3);
            href.parentElement.appendChild(aM);
        }

        function page_addLinksSearch(href, text) {
            const aT2 = document.createElement("a");
            aT2.innerText = " S ";
            aT2.target = "_blank";
            aT2.href = "http://localhost:8097/?search=" + encodeURIComponent(text);

            const aT3 = document.createElement("a");
            aT3.innerText = " SN1 ";
            aT3.target = "_blank";
            aT3.href = "https://nzbgeek.info/geekseek.php?&browseincludewords=" + encodeURIComponent(text);

            const aT4 = document.createElement("a");
            aT4.innerText = " SN2 ";
            aT4.target = "_blank";
            aT4.href = "https://nzbfinder.ws/search?search=" + encodeURIComponent(text);

            href.parentElement.appendChild(aT2);
            href.parentElement.appendChild(aT3);
            href.parentElement.appendChild(aT4);
        }

        // 1. extract results to objects
        let resultDivs = jQuery("div.one_result");

        resultDivs.each(function(i, val) {
            const torrentName = sNormalize(jQuery(val).find("div.torrent_name").text());
            const ahref = jQuery(val).find("a:last")[0];
            const magnetLink = jQuery(val).find("a:last").attr("href");
            const hashId = magnetLink.substring(magnetLink.indexOf("btih:") + 5, 60);

            //console.log("Torrent Name [ %s ], HashId [ %s ], Magnet [ %s ]", torrentName, hashId, magnetLink);

            page_addLinksMagnet(ahref, hashId);
            page_addLinksSearch(ahref, torrentName);
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
