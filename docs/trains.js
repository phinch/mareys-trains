$("document").ready(function(){
    makeTrains(".content#trains.active", 900, 650, "active");
    trainsExpandEvent();
});

function trainsCloseButtonEvent(){
    $("#Trains").find(".closebutton").one("click", function(){
        makeTrains(".content#trains.inactive", 550, 400, "inactive");
        window.setTimeout(trainsExpandEvent, 1000);
    });
}

function trainsExpandEvent(){
    $("#Trains.inactive").one("click", function(){
        makeTrains(".content#trains.active", 900, 650, "active");
        window.setTimeout(trainsCloseButtonEvent, 1000);
    });
}

function makeTrains(selection, w, h, isActive){
   //First, find the distances between cities and place them in dictionary (associative array)
    var cities = [];
    var notset = new Set();
    var yesset = new Set();
    var citydata;
    d3.csv("./city_distances.csv", function(input){
        citydata = input; //city1, city2, miles
        for(var i = 0; i < citydata.length; i++){
            cities[citydata[i].city2] = 0;
            cities[citydata[i].city1] = 0;
            notset.add(citydata[i].city1);
            notset.add(citydata[i].city2);
        }
        var basecity = citydata[0].city1;
        cities[basecity] = 0;
        var mindist = 0;
        notset.delete(basecity);
        yesset.add(basecity);
        
        //While we have unset distances on cities, we'll continue iterating through the dataset.
        while (notset.size != 0){
            //For loop through and update distances
            for(var i = 0; i < citydata.length; i++){
                var route = citydata[i];
                var city1 = route.city1;
                var city2 = route.city2;
                var newdist = 0;
                if(yesset.has(city1) && !yesset.has(city2)){ //City 2 is +miles away from City 1
                    newdist = cities[city1] + parseInt(route.miles)/8;
                    cities[city2] = newdist;
                    notset.delete(city2);
                    yesset.add(city2);
                }else if(yesset.has(city2) && !yesset.has(city1)){ //City 1 is -miles away from City 2
                    newdist = cities[city2] - parseInt(route.miles)/8;
                    cities[city1] = newdist;
                    notset.delete(city1);
                    yesset.add(city2);
                }
                if(newdist < mindist){
                    mindist = newdist;
                }
            }
        }

        mindist = -mindist;
        for(var key in cities){
            cities[key] += mindist;
        }

        //cities now contains all of the cities with relative distances, forming the basis for our vertical axis.
        //We can now set about finding a time range using the time csv.
        getTimes(cities, selection, w, h, isActive);
    });
}
function getTimes(cities, selection, w, h, isActive){
    var timedata;
    //We'll convert 24-hour times into numbers we can use for positioning in d3, based on units of 10-minute intervals.
    //e.g. 0:00 is 0, 0:10 is 1, 7:00 is 42, 7:30 45, etc.
    var earlytime = 145;
    var latetime = -1;
    d3.csv("hyperloop.csv", function(input){
        timedata = input; 
        //Each object is a train with train_name and arrival and departure times in format "[city] [arrive/depart]". Null for invalid stop.
        for(var i = 0; i < timedata.length; i++){
            var train = timedata[i];
            var keys = Object.keys(train);
            for(var j = 1; j < keys.length; j++){ //Setting to 1 cuts out the train_name
                var times = train[keys[j]].split(":");
                var time = parseInt(times[0])*6 + parseInt(times[1])/10
                if(time == null){
                    continue;
                }
                if(time < earlytime){
                    earlytime = time;
                }
                if(time > latetime){
                    latetime = time;
                }
            }
        }

        earlytime -= 6
        latetime += 6

        //We've now found our earliest and latest times, marking the bounds on our horizontal axis.
        //This function is called after we've found our vertical axis, so we now know the information to draw the whole grid.
        drawGrid(cities, timedata, earlytime, latetime, selection, w, h, isActive);
    });
}

function drawGrid(cities, timedata, earlytime, latetime, selection, w, h, isActive){
    var svg = d3.select(selection).append("svg").attr("width", w).attr("height", h).style("background", "#fafafa"),
    margin = {top: 20, right: 70, bottom: 30, left: 100},
    width = svg.attr("width") - margin.left - margin.right,
    height = svg.attr("height") - margin.top - margin.bottom,
    g = svg.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    var parseTime = d3.timeParse("%H:%M");

    var x = d3.scaleTime().range([0, width]),
    y = d3.scaleLinear().range([height, 0])

    var new_cities = [];
    for(var c in cities){
        new_cities.push([c, cities[c]]);
    }

    y.domain([
        0,
        d3.max(new_cities, function(c){return c[1];})
    ]);

    x.domain([
        earlytime,
        latetime
    ]);

    //Add city names
    svg.selectAll(".city")
        .data(new_cities)
        .enter()
        .append("text")
        .classed("city trains "+isActive, true)
        .attr("y", function(k){return y(k[1])+margin.top+3})
        .attr("x", 85)
        .attr("text-anchor", "end")
        .text(function(k){return k[0];});

    //Add horizontal lines at the cities

    g.selectAll("path")
        .data(new_cities)
        .enter()
        .append("path")
        .classed("cityline trains "+isActive, true)
        .attr("d", function(city){
            height = y(city[1])
            var path = "M"+x(earlytime)+" ";
            path += height;
            path += " L"+(width)+" "+(height);
            return path;
        });

    //Add times at the top
    //Add vertical time lines
    for(var t = earlytime; t <= latetime; t++){
        //Always draw a vertical line at position t. If it's on an hour, denote a time label at the top as well.
        g.append("path")
            .classed("timeline", true)
            .attr("d", "M"+x(t)+" "+y(0)+" L"+x(t)+" "+y(y.domain()[1]))
            .attr("stroke", function(){
                if(t%6 == 0){
                    return "#111111"
                }else{
                    return "#aaaaaa"
                }
            })

        //Add a label at each hour
        if(t%6 == 0){
            var hour = t/6
            var text = ""
            if(hour > 12){
                text = hour%12+"pm"
            }else if(hour == 12){
                text = "12pm"
            }else{
                text = hour%12+"am"
            }
            svg.append("text")
                .classed("timelabel trains "+isActive, true)
                .attr("y", y(y.domain()[0])+margin.top+15)
                .attr("x", x(t) + margin.left)
                .text(text)
                .attr("text-anchor", "middle");

            svg.append("text")
                .classed("timelabel trains "+isActive, true)
                .attr("y", y(y.domain()[1])+margin.top-8)
                .attr("x", x(t) + margin.left)
                .text(text)
                .attr("text-anchor", "middle");
        }
                
    }

    var tooltip = d3.select("body").append("div")
        .attr("class", "tooltip trains active")
        .style("display", "none");

    var train_names = {}
    for(var t in timedata){
        train_names[timedata[t].train_name] = timedata[t];
    }

    //Add train lines
    g.selectAll("trains")
        .data(timedata)
        .enter()
        .append("path")
        .classed("trainline trains "+isActive, true)
        .attr("id", function(t){return t.train_name;})
        .attr("d", function(t){
            var points = getPoints(t, cities, earlytime, latetime);
            var path = "M"+x(points[0][0])+" "+y(points[0][1]);
            for(var p = 1; p < points.length; p++){
                var point = points[p]
                path += " L"+x(point[0])+" "+y(point[1]);
            }
            return path;
        })
        .attr("stroke", function(t){return genColor(t);})
        .attr("stroke-width", "1.5px")
        .attr("fill", "none")
        .on("mouseover", function(){
            if(isActive == "inactive"){
                return;
            }
            d3.select(d3.event.target).style("stroke-width", "3.5px");
            var text = "<p>The <span class='placename trains active'>"+d3.select(d3.event.target).attr("id")+"</span> Line<br>";
            var stops = getTooltipText(train_names[d3.select(d3.event.target).attr("id")]);
            console.log(stops)
            for(var s in stops){
                var stop = stops[s];
                var action = stop[2].substring(stop[2].lastIndexOf(" ")+1,stop[2].length)+"s";
                var place = stop[2].substring(0, stop[2].lastIndexOf(" "));
                var time = stop[1].split(":")
                if(parseInt(time[0]) > 12){
                    time = parseInt(time[0])-12 + ":" + time[1] +"pm"
                }else if(parseInt(time[0]) == 12){
                    time = stop[1]+"pm"
                }else{
                    time = stop[1]+"am"
                }
                text += action + " <span class='placename trains active'>" + place +"</span>: " + time + "<br>"
            }
            text += "</p>";
            tooltip.style("display", "inline")
                .html(text);
        })
        .on("mousemove", function(){
            if(isActive == "inactive"){
                return;
            }
            tooltip.style("left", (d3.event.pageX) + "px")
                .style("top", (d3.event.pageY + 20) + "px");
        })
        .on("mouseout", function(){
            if(isActive == "inactive"){
                return;
            }
            d3.select(d3.event.target).style("stroke-width", "1.5px");
            tooltip.style("display", "none");
        });

}

//Given a train's destination and arrival points, returns the points needed to generate a path, in terms of (10-minute interval, city height) pairs
//Returns sorted by time
function getPoints(train, cities, earlytime, latetime){
    var points = []
    for(var stop in train){
        if(stop == "train_name"){
            continue;
        }
        if(train[stop] == ""){
            continue;
        }
        var height = cities[stop.substring(0, stop.lastIndexOf(" "))]
        var interval = parseInt(train[stop].split(":")[0])*6 + parseInt(train[stop].split(":")[1])/10
        points.push([interval, height]);
    }
    points = points.sort(function(a, b){
        if(a[0] < b[0]){
            return -1;
        }
        if(a[0] > b[0]){
            return 1;
        }
        return 0;
    })
    points.unshift([earlytime, points[0][1]]);
    points.push([latetime, points[points.length-1][1]]);
    return points;
}

//Similar to getPoints, but used for tooltip generation
function getTooltipText(train){
    var points = []
    for(var stop in train){
        if(stop == "train_name"){
            continue;
        }
        if(train[stop] == ""){
            continue;
        }
        var interval = parseInt(train[stop].split(":")[0])*6 + parseInt(train[stop].split(":")[1])/10
        points.push([interval, train[stop], stop]);
    }
    points = points.sort(function(a, b){
        if(a[0] < b[0]){
            return -1;
        }
        if(a[0] > b[0]){
            return 1;
        }
        if(a[2].substring(a[2].lastIndexOf(" ")+1, a[2].length) == "arrive" && b[2].substring(b[2].lastIndexOf(" ")+1, b[2].length) == "depart"){
            console.log(a[2], b[2]);
            return -1;
        }
        if(a[2].substring(a[2].lastIndexOf(" ")+1, a[2].length) == "depart" && b[2].substring(b[2].lastIndexOf(" ")+1, b[2].length) == "arrive"){
            console.log(a[2], b[2]);
            return 1;
        }
        return 0;
    })
    return points;
}

function genColor(train){
    var passenger = train.train_name;
    var color = "#";
    var letter;
    for(var i in passenger){
        letter = (passenger[i].charCodeAt()%16).toString(16);
        color += letter;
        if(color.length == 7){
            break;
        }
    }
    while (color.length < 7){
        color += Math.floor((Math.random() * 16)).toString(16);
    }
    return color;
}
