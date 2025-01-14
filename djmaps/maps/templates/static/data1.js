var dataCrimes;
var dbPredict = [];
var clusterOfEachPoint = []; //lstm cluster of each point
var timeseriesToPredict = [];

function rgbToHex(color) {
	var hex = Number(color).toString(16);
  	if (hex.length < 2) {
	    hex = "0" + hex;
	}
  	return hex;
}

function fullRGBtoHex(r, g, b) {
	var red = rgbToHex(r);
  	var green = rgbToHex(g);
  	var blue = rgbToHex(b);
  	return red + green + blue;
}

/* FOR THE COLORS FUNCTION BELOW
'match', ["get", "0.05cluster"], "-1", "#000000", 
		"0", "#a9a9a9", "1", "#cc0000",
		"2", "#cc6600", "3", "#cccc00",
		"4", "#66cc00", "5", "#00cccc",
		"6", "#0066cc", "7", "#0000cc",
		"8", "#6600cc", "9", "#cc00cc",
		"10", "#cc0066", "11", "#ff0000", 
		"12", "#ff8000", "13", "#ffff00",
		"14", "#80ff00", "15", "#00ff80",
		"16", "#00ffff", "17", "#0080ff",
		"#ff99ff" <---FUNCTION BELOW (colors(DBSCANdistance)) INTENDED TO 
					  OUTPUT ARRAY THAT MATCHES THIS ARRAY
*/

function colors(DBSCANdistance) {
	var colorArr = new Array();
	var usedColors = new Set();

	colorArr.push("match");

	var specifyClusterDistance = new Array();
	specifyClusterDistance.push("get");
	specifyClusterDistance.push(String(DBSCANdistance));

	colorArr.push(specifyClusterDistance);
	colorArr.push("-1");
	colorArr.push("#000000");
	colorArr.push("0");
	colorArr.push("#ff8080");

	usedColors.add("#000000");
	usedColors.add("#ff8080");
	usedColors.add("#a9a9a9");

	var i = 1;

	while(colorArr.length < 800) {
		var rColor = Math.floor(Math.random() * 256);
		var gColor = Math.floor(Math.random() * 256);
		var bColor = Math.floor(Math.random() * 256);
		var hex = "#" + fullRGBtoHex(rColor, gColor, bColor);
		if(usedColors.has(hex) == false) {
			colorArr.push(String(i));
			colorArr.push(hex);
			usedColors.add(hex);
			i++;
		}
	}

	colorArr.push("#a9a9a9");
	return colorArr;
}


//DFS FOR LSTM
function isVisited(point, visited) {
	for(var i = 0; i < visited.length; i++) {
		if(point[0] == visited[i][0] && point[1] == visited[i][1]) return true;
	}
	return false;
}

function dfsInit(edges, point) { //point: lon lat pair making up the first vertex FOR ONE CLUSTER
	var clusterInOrder = new Array();
	var visited = new Array();
	dfs(clusterInOrder, edges, point, visited);
	return clusterInOrder;
}

function dfs(clusterInOrder, edges, point, visited) { //reCuRSioN iS ReDunDaNt
	visited.push(point);
	clusterInOrder.push(point);
	var neighbors = getNeighbors(edges, point);
	for(var i = 0; i < neighbors.length; i++) {
		if(!isVisited(neighbors[i], visited)) {
			dfs(clusterInOrder, edges, neighbors[i], visited);
		}
	}
}

function getNeighbors(edges, point) { //getting neighbors of a point in DFS
	var neighbors = new Array();
	for(var i = 0; i < edges.length; i++) {
		if(edges[i][0] == point[0] && edges[i][1] == point[1]) {
			neighbors.push([edges[i][2], edges[i][3]]);
		} 
		if(edges[i][2] == point[0] && edges[i][3] == point[1]) {
			neighbors.push([edges[i][0], edges[i][1]]);
		}
	}
	if (neighbors.length > 2) {
		console.log('WTF', point, edges);
	}
	return neighbors;
}
//END OF DFS


function updateLSTMRangeInput(val) { //for LSTM gridshape range HTML input 
	var LSTM = document.querySelector("#LSTMRangeLabel");
	LSTM.innerHTML = val + " x " + val;
}



$.getJSON("./static/dataCrime1.json", function(dC) {
	dataCrimes = dC;
	var filterPoints = dataCrimes;
	//var fs = require("fs");
	//var datesFromOrdinal = fs.readFileSync("./static/ordinalToDate.txt").toString().split("\n");
	/*for(var i = 0; i < datesFromOrdinal.length; i++) {
		console.log(datesFromOrdinal[i]);
	}*/

	var filterGroup = document.getElementById('filter-group');

	mapboxgl.accessToken = 'pk.eyJ1Ijoia2F0aGxlZW54dWUiLCJhIjoiY2pyOXU5Z3JlMGxiNzQ5cGgxZmo5MWhzeiJ9.xyOwT8LWfjpOlEvPF2Iy7Q';
		const map = new mapboxgl.Map({
		container: 'map',
		//style: 'mapbox://styles/kathleenxue/cjrd2z9b43cef2spckex2oq0z',
		style: 'mapbox://styles/mapbox/light-v9',
		center: [-118.2851,34.0226],
		zoom: 14
	});

	var ct = new Set();
	var days = new Set();

	for(var i = 0; i < dataCrimes.features.length; i++) {
		ct.add(dataCrimes.features[i].properties.Category);
		//console.log(dataCrimes.features[i].properties.Category);
		days.add(dataCrimes.features[i].properties.time.toString());
	}

	var crimeType = new Array();

	ct.forEach(function(value) {
		crimeType.push(value);
	});

	crimeType.sort();

	var dateCommitted = new Array();
	var timeCommitted = new Array();
	var clusters = new Array(); //DBSCAN
	var clusterBoundaries = [[[[[]]]]];


	days.forEach(function(value) {
		dateCommitted.push(value);
		timeCommitted.push(value);
		//console.log(value);
	});

	$("#crimeType").append("<input class = 'change' type = 'checkbox' id = 'crimeType-ALL' name = 'crimeType-ALL' font='sans-serif' checked></input>");
	$("#crimeType").append("<label for = 'crimeType-ALL'> Select All</label><br>");

	$("#crimeType").append("<input class = 'change' type = 'checkbox' id = 'crimeType-NONE' name = 'crimeType-NONE' font='sans-serif'></input>");
	$("#crimeType").append("<label for = 'crimeType-NONE'> Select None</label><br><br>");

	for(var i = 0; i < crimeType.length; i++) {
		$("#crimeType").append("<input class = 'change' type = 'checkbox' id = 'crimeType-" + crimeType[i] + "' name = 'crimeType-" + crimeType[i] + "' font='sans-serif' checked></input>");
		$("#crimeType").append("<label for = 'crimeType-" + crimeType[i] + "'> " + crimeType[i] + "</label><br>");
	}

	$("#dates").append("<input class = 'change' type = 'checkbox' id = 'day-ALL' name = 'day-ALL' font='sans-serif' checked></input>");
	$("#dates").append("<label for = 'day-ALL'>Select All</label><br>");

	$("#dates").append("<input class = 'change' type = 'checkbox' id = 'day-NONE' name = 'day-NONE' font='sans-serif'></input>");
	$("#dates").append("<label for = 'day-NONE'>Select None</label><br>");

	$("#dates").append("<br><b>Filter by Date Range</b><br>");
	$("#dates").append("<input data-dependent-validation='{'from': 'date-to', 'prop': 'max'}' class = 'change' type = 'date' id='date-from' name='date-from' placeholder='from'></input>");
	$("#dates").append("<input data-dependent-validation='{'from': 'date-from', 'prop': 'min'}' class = 'change' type = 'date' id='date-to' name='date-to' placeholder='to'></input>");
	$("#dates").append("<input class='change' type='submit' id='submit' name='submit' /><br>");
	
	$("#dates").append("<br><b>Filter by Day of Week</b><br>");
	$("#dates").append("<input class = 'change' type = 'checkbox' id='day-Mondays' name='day-Mondays' font='sans-serif' checked></input>");
	$("#dates").append("<label for = 'day-Mondays'>Mondays</label><br>");
	$("#dates").append("<input class = 'change' type = 'checkbox' id='day-Tuesdays' name='day-Tuesdays' font='sans-serif' checked></input>");
	$("#dates").append("<label for = 'day-Tuesdays'>Tuesdays</label><br>");
	$("#dates").append("<input class = 'change' type = 'checkbox' id='day-Wednesdays' name='day-Wednesdays' font='sans-serif' checked></input>");
	$("#dates").append("<label for = 'day-Wednesdays'>Wednesdays</label><br>");
	$("#dates").append("<input class = 'change' type = 'checkbox' id='day-Thursdays' name='day-Thursdays' font='sans-serif' checked></input>");
	$("#dates").append("<label for = 'day-Thursdays'>Thursdays</label><br>");
	$("#dates").append("<input class = 'change' type = 'checkbox' id='day-Fridays' name='day-Fridays' font='sans-serif' checked></input>");
	$("#dates").append("<label for = 'day-Fridays'>Fridays</label><br>");
	$("#dates").append("<input class = 'change' type = 'checkbox' id='day-Saturdays' name='day-Saturdays' font='sans-serif' checked></input>");
	$("#dates").append("<label for = 'day-Saturdays'>Saturdays</label><br>");
	$("#dates").append("<input class = 'change' type = 'checkbox' id='day-Sundays' name='day-Sundays' font='sans-serif' checked></input>");
	$("#dates").append("<label for = 'day-Sundays'>Sundays</label>");
		//$("#dates").append("<label for = 'day-" + dateCommitted[i] + "'> " + datesFromOrdinal[i] + "</label>");

	$("#timeOfDay").append("<input class = 'change' type = 'checkbox' id='tod-ALL' name='tod-ALL' font='sans-serif' checked></input>");
	$("#timeOfDay").append("<label for = 'tod-ALL'>Select All</label><br>");
	$("#timeOfDay").append("<input class = 'change' type = 'checkbox' id='tod-NONE' name='tod-NONE' font='sans-serif'></input>");
	$("#timeOfDay").append("<label for = 'tod-Morning'>Select None</label><br>");
	$("#timeOfDay").append("<input class = 'change' type = 'checkbox' id='tod-Morning' name='tod-Morning' font='sans-serif' checked></input>");
	$("#timeOfDay").append("<label for = 'tod-Morning'>Morning (5 am to 10 am)</label><br>");
	$("#timeOfDay").append("<input class = 'change' type = 'checkbox' id='tod-Noon' name='tod-Noon' font='sans-serif' checked></input>");
	$("#timeOfDay").append("<label for = 'tod-Noon'>Noon (11 am to 2 pm)</label><br>");
	$("#timeOfDay").append("<input class = 'change' type = 'checkbox' id='tod-Afternoon' name='tod-Afternoon' font='sans-serif' checked></input>");
	$("#timeOfDay").append("<label for = 'tod-Afternoon'>Afternoon (3 pm to 6 pm)</label><br>");
	$("#timeOfDay").append("<input class = 'change' type = 'checkbox' id='tod-Evening' name='tod-Evening' font='sans-serif' checked></input>");
	$("#timeOfDay").append("<label for = 'tod-Evening'>Evening (7 pm to 11 pm)</label><br>");
	$("#timeOfDay").append("<input class = 'change' type = 'checkbox' id='tod-Night' name='tod-Night' font='sans-serif' checked></input>");
	$("#timeOfDay").append("<label for = 'tod-Night'>Night (12 am to 4 am)</label><br>");

	$("#DBScan").append("Distance between points (miles) <input class ='change' type='number' id='DBScanInput' name='DBScanInput' font='sans-serif' min='0.0' max='1' step='0.05'></input><br>");
	$("#DBScan").append("<input class='change' type='submit' id='DBSCANsubmit' name='DBSCANsubmit'/>");

	$("#LSTMCluster").append("Precision of grid (1x1 to 10x10) <input class='change' type='range' onchange=\"updateLSTMRangeInput(this.value);\" id='LSTMRange' font='sans-serif min='2' max='10'></input><p id='LSTMRangeLabel' style='font-size:14px;'></p><br>");
	$("#LSTMCluster").append("Threshold <input class='change' type='number' id='LSTMThreshold' name='LSTMThreshold' font='sans-serif' value='10000' min='0' max='100000' step='10000'></input><br><br>");
	$("#LSTMCluster").append("<input class='change' type='submit' id='LSTMsubmit' name='LSTMsubmit'/><br><br>");



	var colorArr = new Array();
	var DBSCANdistance = "0cluster";
	colorArr = colors(DBSCANdistance);

	function updateFilteredPoints(crimeType, dateCommitted, timeCommitted) {
		filterPoints = new Array();
		times = []
		for (var i = 0; i < timeCommitted.length; i++) {
			times.push(timeCommitted[i].split('T')[1]);
		}
		dateCommitteds = new Set(dateCommitted);
		crimeTypes = new Set(crimeType);
		timeCommitteds = new Set(times);
		for(var i = 0; i < dataCrimes.features.length; i++) {
			var category = dataCrimes.features[i].properties.Category;
			var date = dataCrimes.features[i].properties.time;
			var time = dataCrimes.features[i].properties.time;
			if(filterExists(crimeTypes, category, 0) && filterExists(dateCommitteds, date, 1) && filterExists(timeCommitteds, time.split('T')[1], 1)) {
				filterPoints.push(dataCrimes.features[i]); 
			}
		}
		//console.log(dataCrimes.features.length, filterPoints.length);
		return filterPoints;
	}

	function filterExists(filterArray, curParam, isTime) {
		return filterArray.has(curParam);
	}
	

	function findDBScanCluster(DBSCANdistance, features) {
		var DBScanClusterTimeSeries = {};
		//find the week that the crime occurred
		//find the cluster of the crime
		//append the crime's cluster of the crime's 
		for(var i = 0; i < features.length; i++) {
			d = features[i].properties.time;
			var dayOfCrime = new Date(d);
			var dayDiff = dayOfCrime.getDate() - dayOfCrime.getDay();
			var weekOfCrime = new Date(dayOfCrime.setDate(dayDiff));
			weekOfCrime.setHours(0);
			weekOfCrime.setMinutes(0);
			weekOfCrime.setSeconds(0);
			weekOfCrime.setMilliseconds(0);
			var cluster = features[i].properties[DBSCANdistance];
			if (!(weekOfCrime.getTime() in DBScanClusterTimeSeries)) {
				DBScanClusterTimeSeries[weekOfCrime.getTime()] = 0;
			}
			DBScanClusterTimeSeries[weekOfCrime.getTime()]++;
		}
		DBScanClusterTimeSeriesArray = [];
		keys = Object.keys(DBScanClusterTimeSeries).sort();
		console.log(keys);
		last = keys.length - 1;
		while (keys[last] == "NaN") {
			last--;
		}
		date = new Date();
		lastDate = new Date();
		date.setTime(keys[0]);
		lastDate.setTime(keys[last]);
		while (date <= lastDate) {
			if (date.getTime() in DBScanClusterTimeSeries) {
				DBScanClusterTimeSeriesArray.push(DBScanClusterTimeSeries[date.getTime()]);
			} else {
				DBScanClusterTimeSeriesArray.push(0);
			}
			date.setDate(date.getDate() + 7);
		}
		return DBScanClusterTimeSeriesArray;
	}

	function LSTMtimeseries(clusterOfEachPoint, features) {
		var lstmClusterTimeSeries = {};

		for(var i = 0; i < features.length; i++) {
			_time = features[i].properties.time;
			var dayOfCrime = new Date(_time);
			var dayDiff = dayOfCrime.getDate() - dayOfCrime.getDay();
			var weekOfCrime = new Date(dayOfCrime.setDate(dayDiff));
			weekOfCrime.setHours(0);
			weekOfCrime.setMinutes(0);
			weekOfCrime.setSeconds(0);
			weekOfCrime.setMilliseconds(0);
			var cluster = clusterOfEachPoint[i];
			if(!(weekOfCrime.getTime() in lstmClusterTimeSeries)) {
				lstmClusterTimeSeries[weekOfCrime.getTime()] = 0;
			}
			lstmClusterTimeSeries[weekOfCrime.getTime()]++;
		}

		keys = Object.keys(lstmClusterTimeSeries).sort();
		last = keys.length - 1;
		while (keys[last] == "NaN") {
			last--;
		}
		date = new Date();
		lastDate = new Date();
		date.setTime(keys[0]);
		lastDate.setTime(keys[last]);
		lstmClusterTimeSeriesArray = [];
		while (date <= lastDate) {
			if (date.getTime() in DBScanClusterTimeSeries) {
				lstmClusterTimeSeriesArray.push(lstmClusterTimeSeries[date.getTime()]);
			} else {
				lstmClusterTimeSeriesArray.push(0);
			}
			date.setDate(date.getDate() + 7);
		}
		console.log(lstmClusterTimeSeriesArray);
		return lstmClusterTimeSeriesArray;
	}

	function isInCluster(clusterBoundaries, coordLon, coordLat) {
		if(clusterBoundaries.length < 3) return false;
		var pointExtreme = [coordLon, 100];
		var count = 0;
		for (var i = 0; i < clusterBoundaries.length; i++) {
			if(segmentsIntersect(clusterBoundaries[i][0], clusterBoundaries[i][1], 
				clusterBoundaries[i][2], clusterBoundaries[i][3],
				coordLon, coordLat,
				pointExtreme[0], pointExtreme[1])) {
				count++;
			}
		}
		return count % 2 == 1;
	}

	function segmentsIntersect(a,b,c,d,p,q,r,s) {
		var det, gamma, lambda;
		det = (c - a) * (s - q) - (r - p) * (d - b);
	 	if (det === 0) {
			return false;
		} else {
			lambda = ((s - q) * (r - a) + (p - r) * (s - b)) / det;
			gamma = ((b - d) * (r - a) + (c - a) * (s - b)) / det;
			return (0 < lambda && lambda < 1) && (0 < gamma && gamma < 1);
		}
	}

	function onSegment(pLon, pLat, qLon, qLat, rLon, rLat) {
		if(qLat <= max(pLat, rLat) && qLat >= min(pLat, rLat) &&
			qLon <= max(pLon, rLon) && qLon >= min(pLon, rLon)) {
			return true;
		}
		return false;
	}

	function intersects(firstLon, firstLat, secLon, secLat, pLon, pLat, exLon, exLat) {
		var o1 = orientation(firstLon, firstLat, secLon, secLat, pLon, pLat);
		var o2 = orientation(firstLon, firstLat, secLon, secLat, exLon, exLat);
		var o3 = orientation(pLon, pLat, exLon, exLat, firstLon, firstLat);
		var o4 = orientation(pLon, pLat, exLon, exLat, secLon, secLat);

		if(o1 != o2 && o3 != o4) return true;

		if(o1 == 0 && onSegment(firstLon, firstLat, pLon, pLat, secLon, secLat)) return true;

		if(o2 == 0 && onSegment(firstLon, firstLat, exLon, exLat, secLon, secLat)) return true;

		if(o3 == 0 && onSegment(pLon, pLat, firstLon, firstLat, exLon, exLat)) return true;

		if(o4 == 0 && onSegment(pLon, pLat, secLon, secLat, exLon, exLat)) return true;

		return false;
	}

	function orientation(firstLon, firstLat, secLon, secLat, thirdLon, thirdLat) {
		var val = (secLon - firstLon) * (thirdLat - secLat) - 
					(secLat - firstLat) * (thirdLon - secLon);
		if(val == 0) return 0;
		return (val > 0) ? 1 : 2;
	}

	function LSTMpointsInEachCluster(clusterBoundaries, features) {
		//clusterBoundaries is array of clusters, clusterBoundaries[j] is cluster j of the array
		//returns an array that gives the points in each LSTM cluster
		var pointsInEachCluster = new Array(clusterBoundaries.length);
		var numPointsInAnyCluster = 0;
		for(var j = 0; j < clusterBoundaries.length; j++) {
			var curCluster = new Array();
			for(var i = 0; i < features.length; i++) {
				
				//console.log("cluster boundaries of j: " + clusterBoundaries[j]);
				
				//clusterLons.sort();
				//console.log("cluster lons: " + clusterLons);
				//console.log(features[i].geometry.coordinates[0] + " vs min lon: " + clusterLons[0] + " max lon: " + clusterLons[clusterLons.length - 1]);
				if(isInCluster(clusterBoundaries[j], parseFloat(features[i].geometry.coordinates[0]), parseFloat(features[i].geometry.coordinates[1]))) {
					curCluster.push(features[i]);
					numPointsInAnyCluster++;
				}
				pointsInEachCluster[j] = curCluster;
				//console.log("curCLUST ER : ! " + JSON.stringify(curCluster));
			}
		}
		//console.log(JSON.stringify(pointsInEachCluster));
		return pointsInEachCluster;
	}

	function LSTMcontains(pointsInEachCluster, curFeature) {
		for(var i = 0; i < pointsInEachCluster.length; i++) {
			curClustFeature = pointsInEachCluster[i];
			//console.log(curClustFeature.geometry);
			if(curClustFeature.geometry.coordinates[0] == curFeature.geometry.coordinates[0] && curClustFeature.geometry.coordinates[1] == curFeature.geometry.coordinates[1]
				&& curClustFeature.properties.time == curFeature.properties.time
				&& curClustFeature.properties.Category == curFeature.properties.Category) {
				return true;
			}
		}
		return false;
	}

	function LSTMclusterOfEachPoint(pointsInEachCluster, features) {
		var clusterOfEachPoint = new Array(features.length).fill(-1);
		//console.log("curCluster: " + pointsInEachCluster[0]);
		for(var i = 0; i < features.length; i++) {
			for(var j = 0; j < pointsInEachCluster.length; j++) {
				var curCluster = new Array();
				curCluster = pointsInEachCluster[j];

				if(LSTMcontains(curCluster, features[i])) {
					clusterOfEachPoint[i] = j;
					break;
				}
			}
		}
		return clusterOfEachPoint;
	}

	function getCookie(name) {
	    var cookieValue = null;
	    if (document.cookie && document.cookie !== '') {
	        var cookies = document.cookie.split(';');
	        for (var i = 0; i < cookies.length; i++) {
	            var cookie = cookies[i].trim();
	            // Does this cookie string begin with the name we want?
	            if (cookie.substring(0, name.length + 1) === (name + '=')) {
	                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
	                break;
	            }
	        }
	    }
	    return cookieValue;
	}

	function csrfSafeMethod(method) {
	    // these HTTP methods do not require CSRF protection
	    return (/^(GET|HEAD|OPTIONS|TRACE)$/.test(method));
	}


	map.on('load', function() {
		map.addSource("dataCrimes", {
			"type": "geojson",
			"data": dataCrimes
		});

		//KEEP THIS COMMENT HERE JUST IN CASE THE "ADDLAYER" METHOD OF DOING THIS BREAKS FOR SOME REASON LOL
		/*map.addSource("clusters", {
			"type": "geojson",
			"data": {
				"type": "Feature",
				"geometry": {
					"type": "Polygon",
					"coordinates": [
						[
							[34.0312, -118.27797375], [34.0258, -118.27797375], [34.0366, -118.2859475], [34.0312, -118.2859475], [34.0312, -118.29392125], [34.0258, -118.29392125], [34.0366, -118.29392125], [34.0366, -118.2859475], [34.0258, -118.29392125], [34.0258, -118.2859475], [34.0312, -118.2859475], [34.0312, -118.27797375], [34.0366, -118.29392125], [34.0312, -118.29392125], [34.0258, -118.2859475], [34.0204, -118.2859475], [34.0258, -118.27797375], [34.0204, -118.27797375], [34.0204, -118.2859475], [34.0204, -118.27797375]
						]
					]
				}
			}
		});*/

		//TEST LSTM CLUSTER
		/*map.addLayer({
			"id": "cluster",
			"type": "fill",
			"source": {
				"type": "geojson",
				"data": {
					"type": "Feature",
					"geometry": {
						"type": "Polygon",
						"coordinates": [
							[[-118.27797375, 34.0312], [-118.27797375, 34.0258], [-118.2859475, 34.0366], [-118.2859475, 34.0312], [-118.29392125, 34.0312], [-118.29392125, 34.0258], [-118.29392125, 34.0366], [-118.2859475, 34.0366], [-118.29392125, 34.0258], [-118.2859475, 34.0258], [-118.2859475, 34.0312], [-118.27797375, 34.0312], [-118.29392125, 34.0366], [-118.29392125, 34.0312], [-118.2859475, 34.0258], [-118.2859475, 34.0204], [-118.27797375, 34.0258], [-118.27797375, 34.0204], [-118.2859475, 34.0204], [-118.27797375, 34.0204]]
						]
					}
				}
			},
			"layout": {},
			"paint": {
				"fill-color": "#0000ff",
				"fill-opacity": 0.4
			}
		});*/ 
		//TEST LSTM CLUSTER


		//MAP LAYER: ALL CRIMES
		map.addLayer({
			"id": "crimes",
			"type": "circle",
			"source": "dataCrimes",
			//line 146 "layout:"...
			"paint": {
				"circle-radius": {
					"base": 3.25,
					"stops": [[12,3.5], [22,180]]
				},
				"circle-color": colorArr,
				"circle-stroke-width": 1,
				"circle-stroke-color": "#ffffff"
			}
		});

		var popup = new mapboxgl.Popup({
			closeButton: false,
			closeOnClick: false
		});
		
		map.on('mouseenter', 'crimes', function(e) {
		// Change the cursor style as a UI indicator.
		map.getCanvas().style.cursor = 'pointer';
		//if(popup) popup.remove(); 
		var coordinates = e.features[0].geometry.coordinates.slice();
		var crimeDate = e.features[0].properties.time;
		var crimeMonth = crimeDate.slice(5,7);
		var crimeDay = crimeDate.slice(8,10);
		var crimeYear = crimeDate.slice(0,4);
		var crimeTime = crimeDate.slice(11,16);
		var description = "<b>Type: " + e.features[0].properties.Category + "</b><br>Date: " 
			+ crimeMonth + "-" + crimeDay + "-" + crimeYear + "<br>"
			+ "Time: " + crimeTime + ":00 PST<br>"
			+ "DBScan Cluster: " + e.features[0].properties[DBSCANdistance] + "<br>"
			+ "LSTM Cluster: " + e.features[0].properties['lstmCluster'] + "<br>";

		if(dbPredict.length > 0) {
			dbPredictData = $.parseJSON(dbPredict);
			//dbPredict = JSON.parse(dbPredict);
			var pred = dbPredictData[0][e.features[0].properties[DBSCANdistance]];
			if(e.features[0].properties[DBSCANdistance] == -1) pred = 0;
			description += "Predicted # of Crimes: " + pred + "<br>";
		}
		 
		// Ensure that if the map is zoomed out such that multiple
		// copies of the feature are visible, the popup appears
		// over the copy being pointed to.
		while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
			coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
		}
		 
		// Populate the popup and set its coordinates
		// based on the feature found.
		popup.setLngLat(coordinates)
			 .setHTML(description)
			 .addTo(map);
		});
		 
		map.on('mouseleave', 'crimes', function() {
			map.getCanvas().style.cursor = '';
			popup.remove();
		});

		map.setFilter("crimes", ["all"]);
	});



	var dateFrom = new Date(0,0,0);
	var dateTo = new Date(0,0,0);
	var numDaysOfWeekChecked = 7;
	var numTimesOfDayChecked = 5;
	var morningStart = 5;
	var morningEnd = 10;
	var noonStart = 11;
	var noonEnd = 14;
	var afternoonStart = 15;
	var afternoonEnd = 18;
	var eveningStart = 19;
	var eveningEnd = 23;
	var nightStart = 0;
	var nightEnd = 4;



	$(document).ready(function() {
		$("#DBPredict").click(function() {
			console.log("dbPredict selected");
			//if(dbPredict.length == 0) do nothing
			x = updateFilteredPoints(crimeType, dateCommitted, timeCommitted)
			/*if(dbPredict.length > 0)  {
				for(var i = 0; i < x.length; i++) {
					//dbPredict[x[i].properties[DBSCANdistance]] //# crimes predicted for this cluster
				}
			}*/

		});

		$('#predict').click(function() {
			$.ajax({
				type: "POST",
				url: "http://localhost:8000/crimePred/predict",
				data: JSON.stringify({
					'features': x,
					'periodsAhead_list': [10],
					'timeseries': timeseriesToPredict,
					'name': $('#predictionName').val(),
					'method': 'LSTM'
				}),
				success: function(data3) {
					dbPredict = data3;
					console.log("PREDICT: " + dbPredict);
				}
			});
		});


		$("#DBSCANsubmit").click(function() {
			//console.log(filterPoints.length);
			/*for(var i = 0; i < filterPoints.length; i++) {

				console.log(filterPoints[i]);
			}*/
			var allFilters = {
				crimeType,
				dateCommitted,
				timeCommitted
			};

			//var csrftoken = getCookie('csrftoken');
			//
			//console.log(allFilters)
			x = updateFilteredPoints(crimeType, dateCommitted, timeCommitted)
			$.ajax({
				type: "POST",
				url: "http://localhost:8000/dbscan",
				data: JSON.stringify({'features': x, 'dist': document.getElementById("DBScanInput").value}),
				success: function(data) {
					data = JSON.parse(data);
					data2 = [];
					for (var key = 0; key < x.length; key++) {
						data2[key] = {};
						data2[key]['geometry'] = data['geometry'][key];
						data2[key]['type'] = data['type'][key];
						data2[key]['properties'] = data['properties'][key];
						//console.log(dataCrimes);
					}
					dataCrimes['features'] = data2;
					map.getSource('dataCrimes').setData(dataCrimes);
					timeseries = findDBScanCluster(DBSCANdistance, x);
					timeseriesToPredict = timeseries; 
					console.log("DBSCANNED " + timeseries);
					
					//console.log(data2);
					//console.log(dataCrimes);
				}
			});

			/*$.ajaxSetup({
			    beforeSend: function(xhr, settings) {
			        if (!csrfSafeMethod(settings.type) && !this.crossDomain) {
			            xhr.setRequestHeader("X-CSRFToken", csrftoken);
			        }
			    }
			});*/

			clusters = [];
			var fileName = document.getElementById("DBScanInput").value + "miles.txt";
			/*const fs = require('fs');
			fs.readFile(fileName, function(text){
    			clusters = text.split("\n") //gives me array assigning each crime to a cluster
			});*/
			var curDistance = parseFloat(document.getElementById("DBScanInput").value);
			//console.log(curDistance);
			if(curDistance == 0 || curDistance == 1) DBSCANdistance = Math.trunc(curDistance).toString() + "cluster";
			else if(curDistance == 0.1 || curDistance == 0.2 || curDistance == 0.3 || curDistance == 0.4 || curDistance == 0.5
				|| curDistance == 0.6 || curDistance == 0.7 || curDistance == 0.8 || curDistance == 0.9) {
				console.log(curDistance);
				var oneDecimal = Math.round(curDistance * 10) / 10;
				DBSCANdistance = oneDecimal.toString() + "cluster";
			}
			else DBSCANdistance = (Math.round(curDistance*100)/100).toFixed(2) + "cluster";
			//console.log(DBSCANdistance);
			var colorArr = colors(DBSCANdistance);
			map.setPaintProperty("crimes", "circle-color", colorArr);

		});


		$("#LSTMsubmit").click(function() {
			//REMOVE ANY CURRENT LSTM CLUSTER LAYERS
			for(var i = 0; i < 10000; i++) {
				var currClusterID = 'cluster' + i;
				var mapLayer = map.getLayer(currClusterID);
				if(typeof mapLayer !== 'undefined') {
			      // Remove map layer & source.
			      map.removeLayer(currClusterID).removeSource(currClusterID);
			    }
			}

			var gridShape = document.getElementById("LSTMRange").value;
			var threshold = document.getElementById("LSTMThreshold").value;
			const Http = new XMLHttpRequest();
			const url='http://localhost:8000/crimePred/cluster/dps/' + gridShape + ',' + gridShape + '/' + threshold;
			console.log("URL:  " + url);
			var allFilters = {
				crimeType,
				dateCommitted,
				timeCommitted
			};

			//var csrftoken = getCookie('csrftoken');
			//
			//console.log(allFilters)
			x = updateFilteredPoints(crimeType, dateCommitted, timeCommitted)
			method = "POST"
			if (method == "GET") {
				$.ajax({
					type: "GET",
					url: url,
					success: function(data) {
						console.log("GETTING CLUSTERS");
						clusterBoundaries = eval(`${data}`);
						console.info(clusterBoundaries);

						for(var i = 0; i < clusterBoundaries[0].length; i++) {
							var currCluster = new Array();
							var clusterID = "cluster" + i;
							for(var j = 0; j < clusterBoundaries[0][i].length; j++) {
								currCluster.push([clusterBoundaries[0][i][j][0], clusterBoundaries[0][i][j][1], clusterBoundaries[0][i][j][2], clusterBoundaries[0][i][j][3]]);
							}
							var firstPoint = [currCluster[0][0], currCluster[0][1]];
							//console.log(firstPoint);
							var orderedCluster = new Array();
							orderedCluster = dfsInit(currCluster, firstPoint); //RUN DFS
							//console.log(colorArr);
							map.addLayer({
								"id": clusterID,
								"type": "fill",
								"source": {
									"type": "geojson",
									"data": {
										"type": "Feature",
										"geometry": {
											"type": "Polygon",
											"coordinates": [
												orderedCluster
											]
										}
									}
								},
								"layout": {},
								"paint": {
									"fill-color": colorArr[2*i+3],
									"fill-opacity": 0.4
								}
							});
						}
					}
				});
			}
			else {
				$.ajax({
					type: "POST",
					url: "http://localhost:8000/crimePred/cluster2",
					data: JSON.stringify({'features': x, 'gridShape': "(" + gridShape + "," +  gridShape + ")", 'threshold': threshold}),
					success: function(data) {
						console.log("GETTING CLUSTERS");
						console.log(x);
						clusterBoundaries = eval(`${data}`);
						//clustCopy = JSON.stringify(clusterBoundaries);
						//clusterBoundaries = JSON.parse("[[[" + clustCopy + "]]]");
						//console.log(clustCopy);
						//console.log("cluster Boundaries: " + clusterBoundaries);
						/*for(var j = 0; j < clusterBoundaries.length; j++) {
							console.log("cluster boundaries at j: " + clusterBoundaries[j]);
							for(var k = 0; k < clusterBoundaries[j].length; k++) {
								console.log("cluster boundaries at k: " + clusterBoundaries[j][k]);
							}
						}*/
						
						

						var clustCopy = new Array();

						for(var i = 0; i < clusterBoundaries[0].length; i++) {
							var currCluster = new Array();
							var clusterID = "cluster" + i;
							for(var j = 0; j < clusterBoundaries[0][i].length; j++) {
								currCluster.push([clusterBoundaries[0][i][j][0], clusterBoundaries[0][i][j][1], clusterBoundaries[0][i][j][2], clusterBoundaries[0][i][j][3]]);
							}
							clustCopy.push(currCluster);
							var firstPoint = [currCluster[0][0], currCluster[0][1]];
							//console.log(firstPoint);
							var orderedCluster = new Array();
							orderedCluster = dfsInit(currCluster, firstPoint); //RUN DFS
							//console.log(colorArr);
							map.addLayer({
								"id": clusterID,
								"type": "fill",
								"source": {
									"type": "geojson",
									"data": {
										"type": "Feature",
										"geometry": {
											"type": "Polygon",
											"coordinates": [
												orderedCluster
											]
										}
									}
								},
								"layout": {},
								"paint": {
									"fill-color": colorArr[2*i+3],
									"fill-opacity": 0.4
								}
							});
						}

						console.log("cluster boundaries: " + clustCopy);
						/*for(var j = 0; j < clustCopy.length; j++) {
							console.log("cluster boundaries at j: " + clustCopy[j]);
							for(var k = 0; k < clustCopy[j].length; k++) {
								console.log("cluster boundaries at k: " + clustCopy[j][k]);
							}
						}*/

						console.log(x);
						console.log(clustCopy);

						var pointsInEachCluster = LSTMpointsInEachCluster(clustCopy, x);
						console.log(pointsInEachCluster);
						console.log("points in each cluster: " + pointsInEachCluster[0].length + " " + pointsInEachCluster[1].length);
						clusterOfEachPoint = LSTMclusterOfEachPoint(pointsInEachCluster, x);
						
						//update points' clusters
						var i = 0;
						console.log(dataCrimes.features);
						for(var y in dataCrimes.features) {
							dataCrimes.features[y].properties['lstmCluster'] = clusterOfEachPoint[i];
							i++;
						}
						map.getSource('dataCrimes').setData(dataCrimes);

						timeseries = LSTMtimeseries(clusterOfEachPoint, x);
						//console.log("cluster of each point: " + clusterOfEachPoint);
						var numNegOnes = 0;
						var numZeroes = 0;
						var numOnes = 0;
						for(var y = 0; y < clusterOfEachPoint.length; y++) {
							if(clusterOfEachPoint[y] == -1) numNegOnes++;
							else if(clusterOfEachPoint[y] == 0) numZeroes++;
							else numOnes++;
						}
						console.log("num neg ones: " + numNegOnes);
						console.log("num zeroes: " + numZeroes);
						console.log("num ones: " + numOnes);
						console.log("LSTMtimeseries: " + timeseries);
						console.log("IN LSTM PREDICT");
						timeseriesToPredict = timeseries;
					}
				});
			}
			//clusterBoundaries --> dfs lon lat
			//add new dfs'ed lon lat layer set to map

		})


		$("#submit").click(function() {
			dateCommitted = ["none"];
    		dateFrom = document.getElementById("date-from").value;
    		dateTo = document.getElementById("date-to").value;
    		//console.log(dateFrom);
    		//console.log(dateTo);
	    	//convert dateFrom and dateTo to python ordinal dates
	    	for(var i = Date.parse(dateFrom) + 8.64e+7; i <= Date.parse(dateTo) + 8.64e+7; i+=8.64e+7) {
	    		var i_ = new Date(i);
	    		curDate = i_.getDate();
	    		var cDate = '' + curDate;
	    		if(curDate < 10) cDate = "0" + curDate.toString();
	    		curMonth = i_.getMonth() + 1;
	    		var cMonth = curMonth.toString();
	    		if(curMonth < 10) cMonth = "0" + curMonth.toString();
	    		curYear = i_.getFullYear();
	    		var cYear = curYear.toString();
	    		for(var j = 0; j <= 24; j++) {
	    			var cHour = "";
	    			if(j <= 9) cHour = "T0" + j.toString() + ":00:00Z";
	    			else cHour = "T" + j.toString() + ":00:00Z";
	    			dateCommitted.push(cYear + "-" + cMonth + "-" + cDate + cHour);
	    		}
	    	}
	    	
	    	$("#dates input[name='day-NONE']:checkbox").prop('checked', false);
	    	
	    	map.setFilter("crimes", ["all", ["match", ["get", "Category"], crimeType, true, false], ["match", ["get", "time"], dateCommitted, true, false], ["match", ["get", "time"], timeCommitted, true, false]]);
	    	filterPoints = updateFilteredPoints(crimeType, dateCommitted, timeCommitted);
	    	//console.log("DATE RANGE FILTER: DONE");
		});


	    $(".change").change(function() {
	    	
	        	if ($(this).prop("checked")) {
		        	if($(this).prop("name").slice(0,3) == "day") {
		        		if($(this).prop("name").slice(4) == "ALL") {
		        			dateCommitted = ["none"];
		        			days.forEach(function(value) {
								dateCommitted.push(value.toString());
							});
							$("#dates input[name='day-NONE']:checkbox").prop('checked', false);
							$("#dates input[name='day-Mondays']:checkbox").prop('checked', true);
							$("#dates input[name='day-Tuesdays']:checkbox").prop('checked', true);
							$("#dates input[name='day-Wednesdays']:checkbox").prop('checked', true);
							$("#dates input[name='day-Thursdays']:checkbox").prop('checked', true);
							$("#dates input[name='day-Fridays']:checkbox").prop('checked', true);
							$("#dates input[name='day-Saturdays']:checkbox").prop('checked', true);
							$("#dates input[name='day-Sundays']:checkbox").prop('checked', true);
							numDaysOfWeekChecked = 7;
		        		}
		        		else if($(this).prop("name").slice(4) == "NONE") {
		        			dateCommitted = ["none"];
		        			$("#dates input[name='day-ALL']:checkbox").prop('checked', false);
		        			$("#crimeType input:checkbox").prop('checked', true);
		        			$("#crimeType input[name='crimeType-NONE']:checkbox").prop('checked', false);
		        			$("#crimeType input[name='crimeType-ALL']:checkbox").prop('checked', true);
		        			$("#dates input[name='day-NONE']:checkbox").prop('checked', true);
		        			$("#dates input[name='day-Mondays']:checkbox").prop('checked', false);
							$("#dates input[name='day-Tuesdays']:checkbox").prop('checked', false);
							$("#dates input[name='day-Wednesdays']:checkbox").prop('checked', false);
							$("#dates input[name='day-Thursdays']:checkbox").prop('checked', false);
							$("#dates input[name='day-Fridays']:checkbox").prop('checked', false);
							$("#dates input[name='day-Saturdays']:checkbox").prop('checked', false);
							$("#dates input[name='day-Sundays']:checkbox").prop('checked', false);
							numDaysOfWeekChecked = 0;
		        		}
		        		else {
		        			numDaysOfWeekChecked += 1;
		        			if(numDaysOfWeekChecked == 1 || numDaysOfWeekChecked == 7) {
		        				if(numDaysOfWeekChecked == 1) {
		        					dateCommitted = ["none"];
			        				$("#dates input[name='day-NONE']:checkbox").prop('checked', false);
			        				$("#dates input[name='day-ALL']:checkbox").prop('checked', false);
			        				$("#crimeType input:checkbox").prop('checked', true);
			        				$("#crimeType input[name='crimeType-NONE']:checkbox").prop('checked', false);
		        				}
		        				else {
		        					$("#dates input[name='day-ALL']:checkbox").prop('checked', true);
		        					$("#crimeType input:checkbox").prop('checked', true);
		        					$("#crimeType input[name='crimeType-NONE']:checkbox").prop('checked', false);
		        				}
		        			}
		        			
		        			if($(this).prop("name").slice(4) == "Mondays") {
			        			days.forEach(function(value) {
			        				var curDate = new Date(value);
			        				if(curDate.getDay() == 1) {
			        					dateCommitted.push(value);
			        				}
			        			});
		        			}
		        			if($(this).prop("name").slice(4) == "Tuesdays") {
			        			days.forEach(function(value) {
			        				var curDate = new Date(value);
			        				if(curDate.getDay() == 2) dateCommitted.push(value);
			        			});
		        			}
		        			if($(this).prop("name").slice(4) == "Wednesdays") {
			        			days.forEach(function(value) {
			        				var curDate = new Date(value);
			        				if(curDate.getDay() == 3) dateCommitted.push(value);
			        			});
		        			}
		        			if($(this).prop("name").slice(4) == "Thursdays") {
			        			days.forEach(function(value) {
			        				var curDate = new Date(value);
			        				if(curDate.getDay() == 4) dateCommitted.push(value);
			        			});
		        			}
		        			if($(this).prop("name").slice(4) == "Fridays") {
			        			days.forEach(function(value) {
			        				var curDate = new Date(value);
			        				if(curDate.getDay() == 5) dateCommitted.push(value);
			        			});
		        			}
		        			if($(this).prop("name").slice(4) == "Saturdays") {
			        			days.forEach(function(value) {
			        				var curDate = new Date(value);
			        				if(curDate.getDay() == 6) dateCommitted.push(value);
			        			});
		        			}
		        			if($(this).prop("name").slice(4) == "Sundays") {
			        			days.forEach(function(value) {
			        				var curDate = new Date(value);
			        				if(curDate.getDay() == 0) dateCommitted.push(value);
			        			});
		        			}

		        			for(var i = 0; i < dateCommitted.length; i++) {
		        				var curDate = new Date(dateCommitted[i]);
		        				console.log(curDate);
		        			}
		        		}
		        		/*else {
		        			dateCommitted.push($(this).prop("name").slice(4).toString());
		        			//console.log(dateCommitted[dateCommitted.length - 1]);
		        			$("#dates input[name='day-NONE']:checkbox").prop('checked', false);
		        		}*/
		        	}

		        	else if($(this).prop("name").slice(0,3) == "tod") {
		        		if($(this).prop("name").slice(4) == "ALL") {
		        			numTimesOfDayChecked = 5;
		        			dateCommitted = ["none"];
		        			days.forEach(function(value) {
								dateCommitted.push(value.toString());
							});
							$("#timeOfDay input[name='tod-ALL']:checkbox").prop('checked', true);
							$("#timeOfDay input[name='tod-NONE']:checkbox").prop('checked', false);
							$("#timeOfDay input[name='tod-Morning']:checkbox").prop('checked', true);
		        			$("#timeOfDay input[name='tod-Noon']:checkbox").prop('checked', true);
		        			$("#timeOfDay input[name='tod-Afternoon']:checkbox").prop('checked', true);
		        			$("#timeOfDay input[name='tod-Evening']:checkbox").prop('checked', true);
		        			$("#timeOfDay input[name='tod-Night']:checkbox").prop('checked', true);
		        			for(var i = 0; i < dateCommitted.length; i++) {
		        				var curTime = new Date(dateCommitted[i]);
		        			}
		        		}
		        		if($(this).prop("name").slice(4) == "NONE") {
		        			timeCommitted = ["none"];
		        			numTimesOfDayChecked = 0;
		        			$("#timeOfDay input[name='tod-ALL']:checkbox").prop('checked', false);
		        			$("#timeOfDay input[name='tod-Morning']:checkbox").prop('checked', false);
		        			$("#timeOfDay input[name='tod-Noon']:checkbox").prop('checked', false);
		        			$("#timeOfDay input[name='tod-Afternoon']:checkbox").prop('checked', false);
		        			$("#timeOfDay input[name='tod-Evening']:checkbox").prop('checked', false);
		        			$("#timeOfDay input[name='tod-Night']:checkbox").prop('checked', false);
		        		}
		        		else {
		        			numTimesOfDayChecked += 1;
		        			if(numTimesOfDayChecked == 1) {
		        				timeCommitted = ["none"];
		        				$("#timeOfDay input[name='tod-NONE']:checkbox").prop('checked', false);
		        			}
		        			if(numTimesOfDayChecked == 5) {
		        				$("#timeOfDay input[name='tod-ALL']:checkbox").prop('checked', true);
		        				$("#timeOfDay input[name='tod-NONE']:checkbox").prop('checked', false);
		        			}
			        		if($(this).prop("name").slice(4) == "Morning") {
			        			days.forEach(function(value) {
			        				var curTime = new Date(value);
			        				if(curTime.getHours() >= 5 && curTime.getHours() <= 10) timeCommitted.push(value);
			        			});
			        		}
			        		if($(this).prop("name").slice(4) == "Noon") {
			        			days.forEach(function(value) {
			        				var curTime = new Date(value);
			        				if(curTime.getHours() >= 11 && curTime.getHours() <= 14) timeCommitted.push(value);
			        			});
			        		}
			        		if($(this).prop("name").slice(4) == "Afternoon") {
			        			days.forEach(function(value) {
			        				var curTime = new Date(value);
			        				if(curTime.getHours() >= 15 && curTime.getHours() <= 18) timeCommitted.push(value);
			        			});
			        		}
			        		if($(this).prop("name").slice(4) == "Evening") {
			        			days.forEach(function(value) {
			        				var curTime = new Date(value);
			        				if(curTime.getHours() >= 19 && curTime.getHours() <= 23) timeCommitted.push(value);
			        			});
			        		}
			        		if($(this).prop("name").slice(4) == "Night") {
			        			days.forEach(function(value) {
			        				var curTime = new Date(value);
			        				if(curTime.getHours() >= 0 && curTime.getHours() <= 4) timeCommitted.push(value);
			        			});
			        		}
		        		}
		        	}

		        	else if($(this).prop("name").slice(0,9) == "crimeType") {
		        		if($(this).prop("name").slice(10) == "ALL") {
		        			crimeType = ["none"];
		        			ct.forEach(function(value) {
								crimeType.push(value);
							});
							$('#crimeType input:checkbox').prop('checked', true);
							$("#crimeType input[name='crimeType-NONE']:checkbox").prop('checked', false);
		        		}
		        		else if($(this).prop("name").slice(10) == "NONE") {
		        			//console.log(crimeType[crimeType.length - 1]);
		        			crimeType = ["none"];
		        			$('#crimeType input:checkbox').prop('checked', false);	
		        			$("#dates input[name='day-ALL']:checkbox").prop('checked', true);
		        			$("#dates input[name='day-NONE']:checkbox").prop('checked', false);
		        			$("#crimeType input[name='crimeType-NONE']:checkbox").prop('checked', true);
		        		}
		        		else {
		        			crimeType.push($(this).prop("name").slice(10));
		        			//console.log(crimeType[crimeType.length - 1]);
		        			$("#crimeType input[name='crimeType-NONE']:checkbox").prop('checked', false);
		        		}
		        	}
		            // if a day was checked add to dates array
		            // if a type was checked add to types array
		        } else {
		        	/*if($(this).prop("name").slice(0,3) == "day") {
		        		//console.log($(this).prop("name"));
		        		for(var i = 0; i < dateCommitted.length; i++) {
			        		if($(this).prop("name").slice(4) == dateCommitted[i]) dateCommitted.splice(i,1);
			        	}
			        	$("#dates input[name='day-ALL']:checkbox").prop('checked', false);
		        	}*/
		        	
		        	if($(this).prop("name").slice(0,9) == "crimeType") {
		        		//console.log($(this).prop("name"));
		        		for(var i = crimeType.length - 1; i >= 0; i--) {
		        			if($(this).prop("name").slice(10) == crimeType[i]) crimeType.splice(i,1);
		        		}
		        		$("#crimeType input[name='crimeType-ALL']:checkbox").prop('checked', false);
		        	}
		            // if a day was unchecked delete it from dates array
		            // if a type was unchecked delete it from types array
		            else if($(this).prop("name").slice(0,3) == "tod") {
		            	numTimesOfDayChecked -= 1;
		            	$("#timeOfDay input[name='tod-ALL']:checkbox").prop("checked", false);
		            	if(numTimesOfDayChecked == 0) {
		            		$("#timeOfDay input[name='tod-NONE']:checkbox").prop('checked', true);
		            	}
		            	if($(this).prop("name").slice(4) == "Morning") {
		            		for(var i = timeCommitted.length - 1; i >= 0; i--) {
		            			var curTime = new Date(timeCommitted[i]);
		            			if(curTime.getHours() >= morningStart && curTime.getHours() <= morningEnd) timeCommitted.splice(i, 1);
		            		}
		            	}
		            	if($(this).prop("name").slice(4) == "Noon") {
		            		for(var i = timeCommitted.length - 1; i >= 0; i--) {
		            			var curTime = new Date(timeCommitted[i]);
		            			if(curTime.getHours() >= noonStart && curTime.getHours() <= noonEnd) timeCommitted.splice(i, 1);
		            		}
		            	}
		            	if($(this).prop("name").slice(4) == "Afternoon") {
		            		for(var i = timeCommitted.length - 1; i >= 0; i--) {
		            			var curTime = new Date(timeCommitted[i]);
		            			if(curTime.getHours() >= afternoonStart && curTime.getHours() <= afternoonEnd) timeCommitted.splice(i, 1);
		            		}
		            	}
		            	if($(this).prop("name").slice(4) == "Evening") {
		            		for(var i = timeCommitted.length - 1; i >= 0; i--) {
		            			var curTime = new Date(timeCommitted[i]);
		            			if(curTime.getHours() >= eveningStart && curTime.getHours() <= eveningEnd) timeCommitted.splice(i, 1);
		            		}
		            	}
		            	if($(this).prop("name").slice(4) == "Night") {
		            		for(var i = timeCommitted.length - 1; i >= 0; i--) {
		            			var curTime = new Date(timeCommitted[i]);
		            			if(curTime.getHours() >= nightStart && curTime.getHours() <= nightEnd) timeCommitted.splice(i, 1);
		            		}
		            	}
		            }
		            else {
		            	$("#dates input[name='day-ALL']:checkbox").prop('checked', false);
		            	numDaysOfWeekChecked -= 1;
		            	if(numDaysOfWeekChecked == 0) {
		            		$("#dates input[name='day-NONE']:checkbox").prop('checked', true);
		            	}
		            	if($(this).prop("name").slice(4) == "Mondays") {
		            		for(var i = dateCommitted.length - 1; i >= 0; i--) {
		            			var curDate = new Date(dateCommitted[i]);
		            			if(curDate.getDay() == 1) {
		            				dateCommitted.splice(i,1);
		            			}
		            		}
		            	}
		            	else if($(this).prop("name").slice(4) == "Tuesdays") {
		            		for(var i = dateCommitted.length - 1; i >= 0; i--) {
		            			var curDate = new Date(dateCommitted[i]);
		            			if(curDate.getDay() == 2) dateCommitted.splice(i,1);
		            		}
		            	}
		            	else if($(this).prop("name").slice(4) == "Wednesdays") {
		            		for(var i = dateCommitted.length - 1; i >= 0; i--) {
		            			var curDate = new Date(dateCommitted[i]);
		            			if(curDate.getDay() == 3) dateCommitted.splice(i,1);
		            		}
		            	}
		            	else if($(this).prop("name").slice(4) == "Thursdays") {
		            		for(var i = dateCommitted.length - 1; i >= 0; i--) {
		            			var curDate = new Date(dateCommitted[i]);
		            			if(curDate.getDay() == 4) dateCommitted.splice(i,1);
		            		}
		            	}
		            	else if($(this).prop("name").slice(4) == "Fridays") {
		            		for(var i = dateCommitted.length - 1; i >= 0; i--) {
		            			var curDate = new Date(dateCommitted[i]);
		            			if(curDate.getDay() == 5) dateCommitted.splice(i,1);
		            		}
		            	}
		            	else if($(this).prop("name").slice(4) == "Saturdays") {
		            		for(var i = dateCommitted.length - 1; i >= 0; i--) {
		            			var curDate = new Date(dateCommitted[i]);
		            			if(curDate.getDay() == 6) dateCommitted.splice(i,1);
		            		}
		            	}
		            	else if($(this).prop("name").slice(4) == "Sundays") {
		            		for(var i = dateCommitted.length - 1; i >= 0; i--) {
		            			var curDate = new Date(dateCommitted[i]);
		            			if(curDate.getDay() == 0) dateCommitted.splice(i,1);
		         
		            		}
		            	}
		            }
	    		}
	        // modify the next line to also work dates
	        map.setFilter("crimes", ["all", ["match", ["get", "Category"], crimeType, true, false], ["match", ["get", "time"], timeCommitted, true, false], ["match", ["get", "time"], dateCommitted, true, false]]);
	        filterPoints = updateFilteredPoints(crimeType, dateCommitted, timeCommitted);
	    });
	});
});




