 /*
	TiebreakerJS is a webapp to manage small MTG tournaments.
  
	Copyright (c) 2014, Johannes Kühnel - www.kraken.at
	All rights reserved.

	TiebreakerJS is licensed under Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License.
	http://creativecommons.org/licenses/by-nc-sa/4.0/deed.en_US 

	THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
	ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
	WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
	DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
	ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
	(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
	LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
	ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
	(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
	SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

/*
	TODO:
	high
	* drops
	* intentional draws
	low
	* randomize playerlist and make draft pods (requires seperate pairings)
	* edit previous rounds
	* see standings between rounds
*/

var currentRound = 0;
var maxRounds = 0;
var players = new Array();
var matches = new Array();
var editMatchId = "";
var editMatch = null;
var pmps = new Array();
var pmws = new Array();
var pgws = new Array();
var playersAsString = "";
var startButton = null;
var finished = false;
var date = new Date();

function Match(ident, round, A, B){
	this.ident = ident;
	this.player1 = A;
	this.player2 = B;
	this.round = round;
	this.games_player1 = 0;
	this.games_player2 = 0;
	this.games_drawn = 0;
}

function Player(player){
	this.player = player;
	this.opponents = new Array();
	this.matches = 0;
	this.matches_won = 0;
	this.matches_drawn = 0;
	this.games = 0;
	this.games_won = 0;
	this.games_drawn = 0;
}

function addMatchResult(match, wins_a, wins_b, draws){
	wins_a = parseInt(wins_a);
	wins_b = parseInt(wins_b);
	draws = parseInt(draws);
	var games = wins_a + wins_b + draws;
	if(wins_a > 2 || wins_a < 0 || wins_b > 2 || wins_b < 0 || draws < 0 || (wins_a + wins_b) > 3 || games < 1)
	{
		alert("Enter a valid result!");
		return;
	}
	var player_a = getPlayerByName(match.player1);
	var player_b = null;
	if(match.player2 !== "BYE")
	{
		player_b = getPlayerByName(match.player2);
		$("span#result_" + match.ident).html("  -  " + wins_a + " / " + wins_b + " / " + draws);
	}
	if((match.games_player1 + match.games_player2 + match.games_drawn) > 0) // overwrite result
	{
		player_a.games = player_a.games - (match.games_player1 + match.games_player2 + match.games_drawn) + games;
		player_a.games_won = player_a.games_won - match.games_player1 + wins_a;
		player_a.games_drawn = player_a.games_drawn - match.games_drawn + draws;
		player_b.games = player_b.games - (match.games_player1 + match.games_player2 + match.games_drawn) + games;
		player_b.games_won = player_b.games_won - match.games_player2 + wins_b;
		player_b.games_drawn = player_b.games_drawn - match.games_drawn + draws;
		if(match.games_player1 > match.games_player2)
			player_a.matches_won--;
		else if(match.games_player1 < match.games_player2)
			player_b.matches_won--;
		else
		{
			player_a.matches_drawn--;
			player_b.matches_drawn--;
		}

		if(wins_a > wins_b)
			player_a.matches_won++;
		else if(wins_b > wins_a)
			player_b.matches_won++;
		else
		{
			player_a.matches_drawn++;
			player_b.matches_drawn++;
		}	
	}
	else // new result
	{
		player_a.matches++;
		player_a.games += games;
		player_a.games_won += wins_a;
		player_a.games_drawn += draws;
		if(player_b != null){
			player_b.matches++;
			player_b.games += games;
			player_b.games_won += wins_b;
			player_b.games_drawn += draws;
			if(wins_a > wins_b)
				player_a.matches_won++;
			else if(wins_b > wins_a)
				player_b.matches_won++;
			else
			{
				player_a.matches_drawn++;
				player_b.matches_drawn++;
			}
		}else
			player_a.matches_won++;
	}

	match.games_player1 = wins_a;
	match.games_player2 = wins_b;
	match.games_drawn = draws;
}

function getMatch(ident){
	for (var i = 0; i < matches.length; i++) {
		if(matches[i].ident === ident)
			return matches[i];
	}
	return null;
}

function getPlayerByName(player_name){
	for (var i = 0; i < players.length; i++) {
		if(players[i].player === player_name)
			return players[i];
	}
	return null;
}

function sortByMatchPoints(a, b){
	return pmps[b.player] - pmps[a.player];
}

/* Tiebreaker (JS sort())
	* Step 0. compare match points
	* Step 1. compare opponents' match-win percentages
	* Step 2. compare game-win percentages
	* Step 3. compare opponent's game-win percentages
*/
function sortByMatchPointsWithTiebreakers(a, b){
	var points_a = pmps[a.player];
	var points_b = pmps[b.player];
	var omw_a = parseFloat(getOpponentsMatchWinPercentages(a));
	var omw_b = parseFloat(getOpponentsMatchWinPercentages(b));
	var pgw_a = pgws[a.player];
	var pgw_b = pgws[b.player];
	var ogw_a = parseFloat(getOpponentsGameWinPercentages(a));
	var ogw_b = parseFloat(getOpponentsGameWinPercentages(b));
	if(points_a !== points_b)
		return points_b - points_a;
	else if(omw_a !== omw_b)
		return omw_b - omw_a;
	else if(pgw_a !== pgw_b)
		return pgw_b - pgw_a;
	else if(ogw_a !== ogw_b)
		return ogw_b - ogw_a;
	else
		return a.player - b.player;
}

function getMatchWinPercentage(player){
	var percentage = Math.max(0.33, pmps[player.player]/(3*player.matches));
	return percentage;
}

function getOpponentsMatchWinPercentages(player){
	var foes = player.opponents.length;
	var percentages = 0;
	for (var i = 0; i < foes; i++) {
		percentages += pmws[player.opponents[i]];
	}
	return percentages/foes;
}

function getGameWinPercentage(player){
	var points = (3*player.games_won + player.games_drawn)/(3*player.games);
	return points;
}

function getOpponentsGameWinPercentages(player){
	var foes = player.opponents.length;
	var percentages = 0;
	for (var i = 0; i < foes; i++) {
		percentages += Math.max(pgws[player.opponents[i]], 0.33);
	}
	return percentages/foes;
}

function getNumberOfRounds(){

	if(players.length <= 8)
		return 3;
	else if(players.length <= 16)
		return 4;
	else if(players.length <= 32)
		return 5;
	else if(players.length <= 64)
		return 6;
	else
		return 7;
}

function getPairings(){
	//$('div#resultlistTitle').html("<h3>Round " + currentRound + " of " + maxRounds + ":</h3>");
	$('select#select-round').append("<option value='" + currentRound + "''>Round " + currentRound + " of " + maxRounds + "</option>");
	$('select#select-round').val(currentRound);
	$('select#select-round').selectmenu('refresh');

	$('ol#resultlist').html("");
	var needPairing = players.slice(0, players.length);
	var counter = 0;
	if(currentRound === 1)
	{
		while(needPairing.length > 0) {
			shuffleArray(needPairing);
			var a = needPairing.pop();
			var b = null;
			var ident = currentRound + "_" + counter;
			if(needPairing.length > 0)
			{
				b = needPairing.pop();
				matches.push(new Match(ident, currentRound, a.player, b.player));
				a.opponents.push(b.player);
				b.opponents.push(a.player);
				$('ol#resultlist').append("<li><a href='#enterresult' data-rel='dialog' onclick='editMatchId = \"" + ident + "\"; renderEnterDialog()'>" + a.player + " (" + getPoints(a) + ") vs. " + b.player + " (" + getPoints(b) + ")</a><span id='result_" + ident + "'></span></li>");
			}
			else
			{
				var bye = new Match(ident, currentRound, a.player, "BYE");
				matches.push(bye);
				addMatchResult(bye, 2, 0, 0);
				$('ol#resultlist').append("<li>" + a.player + " (" + (getPoints(a)-3) + ") vs. *BYE*  -  2 / 0 / 0</li>");
			}
			counter++;
		}
	}
	else
	{
		for (var i = 0; i < players.length; i++)
			pmps[players[i].player] = getPoints(players[i]);
		needPairing.sort(sortByMatchPoints);
		var ident = "";

		while(needPairing.length > 1)
		{
			var a = needPairing[0];
			var b = null;

			var offset = 0;
			var played = false;
			do
			{
				played = false;
				offset++;
				if(needPairing.length > offset)
				{
					b = needPairing[offset];
					for (var j = 0; j < a.opponents.length; j++) {
						if(a.opponents[j] === b.player)
							played = true;
					}
				}
				else
				{
					/*
					 TODO: 
					 Take random, or else players are more likely to play players they've already faced several times
					  than ones they have faced once
					
						add already played people into an array and sort it by the # of occurences in a.opponents and points
					 */
					//offset = Math.floor((Math.random()*offset) + 1);
					offset = 1;
					b = needPairing[offset];
				}
			}
			while(played === true);

			ident = currentRound + "_" + counter;
			matches.push(new Match(ident, currentRound, a.player, b.player));
			a.opponents.push(b.player);
			b.opponents.push(a.player);
			$('ol#resultlist').append("<li><a href='#enterresult' data-rel='dialog' onclick='editMatchId = \"" + ident + "\"; renderEnterDialog()'>" + a.player + " (" + getPoints(a) + ") vs. " + b.player + " (" + getPoints(b) + ")</a><span id='result_" + ident + "'></span></li>");
			needPairing.splice(offset, 1);
			needPairing.splice(0, 1);
			counter++;
		}

		if(needPairing.length === 1)
		{
			var a = needPairing.pop();
			var bye = new Match(ident, currentRound, a.player, "BYE");
			matches.push(bye);
			addMatchResult(bye, 2, 0, 0);
			$('ol#resultlist').append("<li>" + a.player + " (" + (getPoints(a) - 3) + ") vs. *BYE*  -  2 / 0 / 0</li>");
		}
	}
}

function shuffleArray(array) {
	for (var i = array.length - 1; i > 0; i--) {
		var j = Math.floor(Math.random() * (i + 1));
		var temp = array[i];
		array[i] = array[j];
		array[j] = temp;
	}
	return array;
}

function getPoints(player){
	return (player.matches_won*3 + player.matches_drawn);
}

function resultsReady(){
	var results = 0;
	matches.forEach(function(entry){
		if(currentRound === entry.round)
			if(entry.games_player1 !== 0 || entry.games_player2 !== 0 || entry.games_drawn !== 0)
				results++;
	});
	return results;
}

function createRound(){
	if(players.length < 4)
		alert("Add at least four (4) players!");
	else if(currentRound > 0 && resultsReady() !== (matches.length/currentRound))
		alert("Enter all match results!");
	else
	{
		if(currentRound === maxRounds)
		{
			//$('div#resultlistTitle').html("<h3>Standings after " + currentRound + " rounds:</h3>");
			$('select#select-round').append("<option value='0'>Standings</option>");
			$('select#select-round').val(0);
			$('select#select-round').selectmenu('refresh');

			$('ol#resultlist').html("");
			for (var i = 0; i < players.length; i++) {
				pmps[players[i].player] = getPoints(players[i]);
				pmws[players[i].player] = parseFloat(getMatchWinPercentage(players[i]));
				pgws[players[i].player] = parseFloat(getGameWinPercentage(players[i]));
			}
			players.sort(sortByMatchPointsWithTiebreakers);
			$('div#resultlistContainer').prepend("<b>Player - points</b> / matches / wins / losses / draws");
			for (var i = 0; i < players.length; i++) {
				$('ol#resultlist').append("<li><b>" + players[i].player + " - " + pmps[players[i].player] + "</b> / "+ players[i].matches + " / " + players[i].matches_won + " / " + (players[i].matches - (players[i].matches_won + players[i].matches_drawn)) + " / " + players[i].matches_drawn + "<br>");
				$('ol#resultlist').append("OMW: " + parseFloat(getOpponentsMatchWinPercentages(players[i])).toFixed(2) + ", PGW: " + pgws[players[i].player].toFixed(2) + ", OGW: " + parseFloat(getOpponentsGameWinPercentages(players[i])).toFixed(2) + "</li>");
			}
			$("a#pairingButton").remove();
			finished = true;
		}
		else
		{
			if(currentRound === (maxRounds - 1))
				$("a#pairingButton").html("Standings");
			else if(currentRound === 0)
			{
				startButton = $("a#startButton").detach();
				$("div#resultButtons").append('<a href="#" id="pairingButton" class="ui-btn ui-corner-all ui-shadow" onclick="createRound();">Create next round!</a>');
				$("div#resultlistTitle").html('<select name="select-round" id="select-round" onchange="renderRound($(\'select#select-round\').val())"></select>');
				$('select#select-round').selectmenu();
			}
			currentRound++;
			getPairings();
		}
	}
}

function renderRound(round){
	$("div#resultlistContainer").html("<ol id='resultlist'></ol>");
	if(round == 0) // Standings
	{
		$('div#resultlistContainer').prepend("<b>Player - points</b> / matches / wins / losses / draws");
		for (var i = 0; i < players.length; i++) {
			$('ol#resultlist').append("<li><b>" + players[i].player + " - " + pmps[players[i].player] + "</b> / "+ players[i].matches + " / " + players[i].matches_won + " / " + (players[i].matches - (players[i].matches_won + players[i].matches_drawn)) + " / " + players[i].matches_drawn + "<br>");
			$('ol#resultlist').append("OMW: " + parseFloat(getOpponentsMatchWinPercentages(players[i])).toFixed(2) + ", PGW: " + pgws[players[i].player].toFixed(2) + ", OGW: " + parseFloat(getOpponentsGameWinPercentages(players[i])).toFixed(2) + "</li>");
		}
	}
	else // Rounds
	{
		matches.forEach(function(entry){
			if(entry.round == round)
			{
				if(entry.player2 === "BYE")
					$('ol#resultlist').append("<li>" + entry.player1 + " (" + (getPoints(getPlayerByName(entry.player1)) - 3) + ") vs. *BYE*  -  2 / 0 / 0</li>");
				else
				{
					if(currentRound === entry.round && !finished)
						$('ol#resultlist').append("<li><a href='#enterresult' data-rel='dialog' onclick='editMatchId = \"" + entry.ident + "\"; renderEnterDialog()'>" + entry.player1 + " (" + getPoints(getPlayerByName(entry.player1)) + ") vs. " + entry.player2 + " (" + getPoints(getPlayerByName(entry.player2)) + ")</a><span id='result_" + entry.ident + "'></span></li>");
					else
						$('ol#resultlist').append("<li>" + entry.player1 + " (" + getPoints(getPlayerByName(entry.player1)) + ") vs. " + entry.player2 + " (" + getPoints(getPlayerByName(entry.player2)) + ")<span id='result_" + entry.ident + "'></span></li>");
				}
				if(entry.games_player1 > 0 || entry.games_player2 > 0 || entry.games_drawn > 0)
					$("span#result_" + entry.ident).html("  -  " + entry.games_player1 + " / " + entry.games_player2 + " / " + entry.games_drawn);
			}
		});
	}
}

function addPlayer(name){
	if(currentRound > 0)
		alert("Cannot add players between rounds!");
	else if(name !== "" && getPlayerByName(name) === null)
	{
		players.push(new Player(name));
		renderPlayerlist();
	}
	else
		alert("Enter a unique player name!");
}

function removePlayer(player){
	if(currentRound > 0)
		alert("Cannot remove players between rounds!");
	else
	{
		var i = 0;
		players.forEach(function(entry){
			if(entry.player === player)
				players.splice(i, 1);
			i++;
		});
	}
}

function sortByName(a, b){
	var name_a = a.player.toLowerCase();
	var name_b = b.player.toLowerCase();
	if(name_a < name_b)
		return -1;
	else if(name_a > name_b)
		return 1;
	else
		return 0;
}

function renderPlayerlist(){
	$("ul#playerlist").html("");
	if(players.length > 0)
	{
		players.sort(sortByName);
		for (var i = 0; i < players.length; i++) {
			$("ul#playerlist").append("<li><a href='#players' onclick='removePlayer(\"" + players[i].player + "\");renderPlayerlist()'>" + players[i].player + "</a></li>");
		}
	}
	else
		$("ul#playerlist").append("<li>no players added</li>");

	playersAsString = "";
	for (var i = 0; i < players.length; i++) {
		playersAsString += players[i].player;
		if(i < (players.length - 1))
			playersAsString += ",";
	};
	// TODO: use actual url
	$("input#url").val("http://tiebreaker.kraken.at/?players=" + playersAsString);
}

function renderEnterDialog(){
	editMatch = getMatch(editMatchId);
	$('div#player_a').html(editMatch.player1);
	$('div#player_b').html(editMatch.player2);
	$('input#wins_a').val(editMatch.games_player1);
	$('input#wins_b').val(editMatch.games_player2);
	$('input#draws').val(editMatch.games_drawn);
}

function getQueryParams(qs) {
    qs = qs.split("+").join(" ");

    var params = {}, tokens, re = /[?&]?([^=]+)=([^&]*)/g;

    while (tokens = re.exec(qs)) {
        params[decodeURIComponent(tokens[1])] = decodeURIComponent(tokens[2]);
    }

    return params;
}

function reset(){
	currentRound = 0;
	maxRounds = 0;
	matches.splice(0, matches.length);
	editMatchId = "";
	editMatch = null;
	pmps.splice(0, pmps.length);
	pmws.splice(0, pmws.length);
	pgws.splice(0, pgws.length);
	renderPlayerlist();
	players.forEach(function(entry){
		entry.opponents.splice(0, entry.opponents.length);
		entry.matches = 0;
		entry.matches_won = 0;
		entry.matches_drawn = 0;
		entry.games = 0;
		entry.games_won = 0;
		entry.games_drawn = 0;
	});
	finished = false;
	$('div#resultlistTitle').html("");
	$('div#resultlistContainer').html("<ol id='resultlist'></ol>");
	if(startButton !== null)
	{
		$("div#resultButtons").html("");
		$("div#resultButtons").append(startButton);
	}
	alert("All rounds have been deleted!");
}

function exportTournament(){
	$("a#exportButton").attr('download', 'tournament_' + date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate() + ".txt");
	var output = "";
	if(players.length > 0)
	{
		output += "Players (" + players.length + "):\n";
		players.forEach(function(entry){
			output += "  " + entry.player + "\n";
		});
	}
	if(matches.length > 0)
	{
		output += "-------------------------------------------\n";
		output += "Matches:\n";

		var roundCnt = 0;
		matches.forEach(function(entry){
			if(entry.round > roundCnt)
			{
				roundCnt++;
				output += " Round " + entry.round + "\n";
			}
			output += "  " + entry.player1 + " vs. " + entry.player2 + " - " +  entry.games_player1 + "/" + entry.games_player2 + "/" + entry.games_drawn + "\n";
		});
	}
	if(finished)
	{
		output += "-------------------------------------------\n";
		output += "Standings (Player - points / matches / wins / losses / draws):\n";
		var place = 1;
		players.forEach(function(entry){
			output += " " + (place++) + ". " + entry.player + " - " + pmps[entry.player] + " / " + entry.matches + " / " + entry.matches_won + " / " + (entry.matches - (entry.matches_won + entry.matches_drawn)) + " / " + entry.matches_drawn;
			output += " - OMW: " + parseFloat(getOpponentsMatchWinPercentages(entry)).toFixed(4) + ", PGW: " + pgws[entry.player].toFixed(4) + ", OGW: " + parseFloat(getOpponentsGameWinPercentages(entry)).toFixed(4) + "\n";
		});
	}
    $("a#exportButton").attr('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(output));
}
