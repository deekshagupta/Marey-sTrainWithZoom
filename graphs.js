var margin = { top: 120, right: 30, bottom: 120, left: 50 };
var height = 600;
var zoom;
var svg;
const uniqueIds = (id) => {
  return id + "-" + Math.floor(Math.random() * 10000 + 1);
};
var pathClip = uniqueIds("clip-path");
var circleClip = uniqueIds("clip-circle");

console.log("pathClip", pathClip);
const parseTime = (string) => {
  const parseTime = d3.utcParse("%I:%M%p");
  // console.log(string);
  //return (string) => {
  const date = parseTime(string);
  // console.log(date);
  if (date !== null && date.getUTCHours() < 3)
    date.setUTCDate(date.getUTCDate() + 1);
  return date;
  // };
};
let configData, colors, lineStroke;

// Load configuration data
d3.json("./config.json").then(function (conf) {
  configData = conf;
  colors = {
    N: configData.config.colors.N,
    L: configData.config.colors.L,
    B: configData.config.colors.B,
    W: "currentColor",
    S: "currentColor",
  };
  lineStroke = configData.config.stationLines.strokeType;
});

var inputData;
var stations;
var data;
var stops;
var width = 600;
var voronoi;

async function getScheduleData() {
  inputData = await d3.tsv("./schedule.tsv");
  alldata();
  stations = alldata().stations;
  data = alldata().filter((d) => /[NLB]/.test(d.type) && d.type);

  stops = d3.merge(
    data.map((d) => d.stops.map((s) => ({ train: d, stop: s })))
  );

  // create tooltip
  const tooltip = (g) => {
    const formatTime = d3.utcFormat("%-I:%M %p");

    const tooltip = g.append("g").style("font", "10px sans-serif");

    const path = tooltip.append("path").attr("fill", "white");

    const text = tooltip.append("text");

    const line1 = text
      .append("tspan")
      .attr("x", 0)
      .attr("y", 0)
      .style("font-weight", "bold");

    const line2 = text.append("tspan").attr("x", 0).attr("y", "1.1em");

    const line3 = text.append("tspan").attr("x", 0).attr("y", "2.2em");

    g.append("g")
      .attr("fill", "none")
      .attr("pointer-events", "all")
      .selectAll("path")
      .data(stops)
      .join("path")
      .attr("d", (d, i) => voronoi.renderCell(i))
      .on("mouseout", () => tooltip.style("display", "none"))
      .on("mouseover", (d) => {
        tooltip.style("display", null);
        line1.text(`${d.train.number}${d.train.direction}`);
        line2.text(d.stop.station.name);
        line3.text(formatTime(d.stop.time));
        path.attr("stroke", colors[d.train.type]);
        const box = text.node().getBBox();
        path.attr(
          "d",
          `
                M${box.x - 10},${box.y - 10}
                H${box.width / 2 - 5}l5,-5l5,5
                H${box.width + 10}
                v${box.height + 20}
                h-${box.width + 20}
                z
              `
        );
        tooltip.attr(
          "transform",
          `translate(${x(d.stop.station.distance) - box.width / 2},${
            y(d.stop.time) + 28
          })`
        );
      });
  };

  // define x axis
  let x = d3
    .scaleLinear()
    .domain(d3.extent(stations, (d) => d.distance))
    .range([margin.left + 10, width - margin.right]);

  // define y axis
  let y = d3
    .scaleUtc()
    .domain([parseTime("4:30AM"), parseTime("3:30PM")])
    .range([margin.top, height - margin.bottom]);

  let yOrig = d3
    .scaleUtc()
    .domain([parseTime("4:30AM"), parseTime("3:30PM")])
    .range([margin.top, height - margin.bottom]);

  let voronoi = d3.Delaunay.from(
    stops,
    (d) => x(d.stop.station.distance),
    (d) => y(d.stop.time)
  ).voronoi([0, 0, 954, height]);

  const xAxis = (g) =>
    g
      .style("font", "10px sans-serif")
      .selectAll("g")
      .data(stations)
      .join("g")
      .attr("transform", (d) => `translate(${x(d.distance)},0)`)
      .call((g) =>
        g
          .append("line")
          .attr("y1", margin.top - 6)
          .attr("y2", margin.top)
          .attr("stroke", "currentColor")
      )
      .call((g) =>
        g
          .append("line")
          .attr("y1", height - margin.bottom + 6)
          .attr("y2", height - margin.bottom)
          .attr("stroke", "currentColor")
      )
      .call((g) =>
        g
          .append("line")
          .attr("y1", margin.top)
          .attr("y2", height - margin.bottom)
          .attr("stroke-opacity", 0.2)
          .attr("stroke-dasharray", "1.5,2")
          .attr("stroke", "currentColor")
      )
      .call((g) =>
        g
          .append("text")
          .attr("transform", `translate(0,${margin.top}) rotate(-90)`)
          .attr("x", 12)
          .attr("dy", "0.35em")
          .text((d) => d.name)
      )
      .call((g) =>
        g
          .append("text")
          .attr("text-anchor", "end")
          .attr("transform", `translate(0,${height - margin.top}) rotate(-90)`)
          .attr("x", -12)
          .attr("dy", "0.35em")
          .text((d) => d.name)
      );

  let yAxis = (g) =>
    g
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).ticks(d3.utcHour).tickFormat(d3.utcFormat("%-I %p")))
      .call((g) => g.select(".domain").remove())
      .call((g) =>
        g
          .selectAll(".tick line")
          .clone()
          .lower()
          .attr("stroke-opacity", 0.2)
          .attr("x2", width)
      );

  // define line
  let line = d3
    .line()
    .x((d) => x(d.station.distance))
    .y((d) => y(d.time));

  // define svg
  svg = d3
    .select(".canvas")
    .append("svg")
    .attr("viewBox", [0, 0, width, height]);

  svg.append("g").attr("class", "axis axis--x").call(xAxis);

  svg.append("g").attr("class", "axis axis--y").call(yAxis);

  // draw graph
  const train = svg
    .append("g")
    .attr("stroke-width", 1.5)
    .selectAll("g")
    .data(data)
    .join("g");

  train
    .append("path")
    .attr("fill", "none")
    .attr("class", "lines")
    .attr("stroke", (d) => colors[d.type])
    .attr("d", (d) => line(d.stops))
    .attr("stroke-dasharray", lineStroke)
    .style("clip-path", `url(#${pathClip})`);

  train
    .append("g")
    .attr("stroke", "white")
    .attr("fill", (d) => colors[d.type])
    .selectAll("circle")
    .attr("class", "circles")
    .data((d) => d.stops)
    .join("circle")
    .attr(
      "transform",
      (d) => `translate(${x(d.station.distance)},${y(d.time)})`
    )
    .attr("r", 2.5)
    .style("clip-path", `url(#${circleClip})`);

  svg.append("g").call(tooltip);

  zoom = d3
    .zoom()
    .scaleExtent([1, 4]) // This control how much you can unzoom (x0.5) and zoom (x20)
    .translateExtent([
      [0, 0],
      [width, height],
    ])
    .extent([
      [0, 0],
      [width, height],
    ])
    .on("zoom", updateChart);

  // This add an invisible rect on top of the chart area. This rect can recover pointer events: necessary to understand when the user zoom
  svg
    .append("rect")
    .attr("width", width)
    .attr("height", height - margin.bottom - margin.top)
    .style("fill", "none")
    .style("pointer-events", "all")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")")
    .call(zoom);
  svg.selectAll("clipPath").remove();
  // svg.call(zoom);

  // Add a clipPath: everything out of this area won't be drawn.
  svg
    .append("defs")
    .append("clipPath")
    .attr("id", pathClip)
    .append("rect")
    .attr("width", width)
    .attr("height", height - margin.bottom - margin.top)
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  svg
    .append("defs")
    .append("clipPath")
    .attr("id", circleClip)
    .append("rect")
    .attr("width", width)
    .attr("height", height - margin.bottom - margin.top)
    //  .attr("x", 0)
    //   .attr("y", 0)
    //.attr("width", width + 2 * 2.5)
    .attr("transform", "translate(-" + 2.5 + ",-5)");
  // .attr("height", height);

  // svg
  //   .append("defs")
  //   .append("clipPath")
  //   .attr("id", circleClip)
  //   .append("rect")
  //   .attr("width", width)
  //   //.attr("transform", "translate(-" + 2.5 + ",0)")
  //   .attr("height", height - margin.bottom - margin.top)
  //   .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  function updateChart() {
    // recover the new scale
    var newX = d3.event.transform.rescaleX(x);
    var newY = d3.event.transform.rescaleY(y);
    // update axes with these new boundaries
    // console.log(newX.domain());
    var t = d3.event.transform;
    y.domain(newY.domain());
    // yAxis = (g) =>
    //   g
    //     .attr("transform", `translate(${margin.left},0)`)
    //     .call(
    //       d3.axisLeft(newY).ticks(d3.utcHour).tickFormat(d3.utcFormat("%-I %p"))
    //     )
    //     .call((g) => g.select(".domain").remove())
    //     .call((g) =>
    //       g
    //         .selectAll(".tick line")
    //         .clone()
    //         .lower()
    //         .attr("stroke-opacity", 0.2)
    //         .attr("x2", width)
    //     );
    svg.select(".axis--y").call(yAxis);
    svg.selectAll("path.lines").attr("d", function (d) {
      return line(d.stops);
    });
    svg
      .selectAll("circle")
      .attr(
        "transform",
        (d) => `translate(${x(d.station.distance)},${y(d.time)})`
      );
    // svg.selectAll("circles").attr((d) => d.stops);
    console.log(y.domain(t.rescaleY(y).domain()));
  }
}

getScheduleData();
const alldata = () => {
  // Extract the stations from the "stop|*" columns.
  const stations = inputData.columns
    .filter((key) => /^stop\|/.test(key))
    .map((key) => {
      const [, name, distance, zone] = key.split("|");
      return { key, name, distance: +distance, zone: +zone };
    });

  return Object.assign(
    inputData.map((d) => ({
      number: d.number,
      type: d.type,
      direction: d.direction,
      stops: stations
        .map((station) => ({ station, time: parseTime(d[station.key]) }))
        .filter((station) => station.time !== null),
    })),
    { stations }
  );
};

var change = function () {
  console.log("button");
  //zoom.transform(svg, d3.zoomIdentity.scale(1));
  // svg.transition().duration(750).call(zoom.transform, d3.zoomIdentity);
  // zoom.transform(svg, d3.zoomIdentity);
  svg.call(zoom.transform, d3.zoomIdentity);
};
