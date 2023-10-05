const steamLikesIife = /* js */ `(async function(){
  // The URL looks like this: https://steamlikes.co/app/1401730
  // Make sure we're on the right host
  if (window.location.host !== 'steamlikes.co') {
    console.error('The Stitch:SteamLikes bookmarklet only works on https://steamlikes.co')
    return;
  }


  // Get the steamId from the URL
  const steamId = window.location.pathname.split('/')[2];

  // Grab the same data that the SteamLikes website uses. Have to do it
  // while ON the site because of CORS, hence this bookmarklet!
	const url = "https://steamlikes.co/app/a/"+steamId+"/likesstatictics";

	const data = (await fetch(url, {})
		.then((res) => res.json())
		.catch((err) => {
			console.error(err);
			return { data: { datasets: [{ data: [] }] } };
		}));
  
  // The date values are just the month and day, so we need to add the year.
  // (This will get janky around the new year!)
  const lastDate = new Date(data.data.labels.at(-1));
  lastDate.setFullYear(new Date().getFullYear());

	const likes = data.data.datasets[0].data.map((likes, i) => ({
		date: new Date(lastDate.getTime() - (13-i) * 24 * 60 * 60 * 1000),
		likes
	}));

  const asCsv = likes.map((entry) => entry.date.toISOString().split('T')[0]+","+entry.likes).join('\\\\n');
  const asJson = JSON.stringify(likes).replace(/"/g, '&quot;');
  const copyAsCsv = "navigator.clipboard.writeText('"+asCsv+"')";
  const copyAsJson = "navigator.clipboard.writeText('"+asJson+"')";
  const copyAsTsv = "navigator.clipboard.writeText('"+asCsv.replace(/,/g, '\\t')+"')";

  const tabEl = document.querySelector('#myTab');
  // Add a sibling after the tabs that adds liks to "Copy as: csv | json"
  const copyEl = document.createElement('div');
  copyEl.id="stitch-copy-container";
  copyEl.innerHTML = 'Stitch: <button onclick="'+copyAsCsv+'">Copy CSV</button> <button onclick="'+copyAsTsv+'">Copy TSV</button>  <button onclick="'+copyAsJson+'">Copy JSON</button>';
  copyEl.style="margin: 1em 0.5em; font-size: 1.2rem; font-weight:bold;"

  const existing = document.querySelector('#stitch-copy-container');
  if (existing) {
    existing.remove();
  }
  tabEl.after(copyEl);
})()`;

export const steamLikesBookmarklet = `javascript:${encodeURIComponent(steamLikesIife)}`;
