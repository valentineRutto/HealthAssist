import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { feature } from 'topojson-client';
import { motion } from 'motion/react';

interface Marker {
  id: number;
  lat: number;
  lng: number;
  type: 'High' | 'Medium' | 'Low';
  count: number;
}

interface WorldMapProps {
  markers: Marker[];
}

const WorldMap: React.FC<WorldMapProps> = ({ markers }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [rotation, setRotation] = useState<[number, number, number]>([0, -20, 0]);
  const [scale, setScale] = useState(250);

  useEffect(() => {
    if (!svgRef.current) return;

    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const projection = d3.geoOrthographic()
      .scale(scale)
      .center([0, 0])
      .rotate(rotation)
      .translate([width / 2, height / 2]);

    const path = d3.geoPath().projection(projection);

    // Background circle for the globe
    svg.append('circle')
      .attr('cx', width / 2)
      .attr('cy', height / 2)
      .attr('r', scale)
      .attr('fill', '#f0f4f8')
      .attr('stroke', '#e2e8f0')
      .attr('stroke-width', 1);

    // Graticule (grid lines)
    const graticule = d3.geoGraticule();
    svg.append('path')
      .datum(graticule())
      .attr('class', 'graticule')
      .attr('d', path as any)
      .attr('fill', 'none')
      .attr('stroke', '#cbd5e1')
      .attr('stroke-width', 0.5)
      .attr('opacity', 0.3);

    // Load world data
    d3.json('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json').then((data: any) => {
      const countries = feature(data, data.objects.countries) as any;

      // Draw countries
      svg.append('g')
        .selectAll('path')
        .data(countries.features)
        .enter()
        .append('path')
        .attr('d', path as any)
        .attr('fill', '#ffffff')
        .attr('stroke', '#94a3b8')
        .attr('stroke-width', 0.5)
        .attr('class', 'country')
        .on('mouseover', function() {
          d3.select(this).attr('fill', '#f1f5f9');
        })
        .on('mouseout', function() {
          d3.select(this).attr('fill', '#ffffff');
        });

      // Draw markers
      const markerGroup = svg.append('g');
      
      markers.forEach(marker => {
        const coords = projection([marker.lng, marker.lat]);
        if (!coords) return;

        // Check if marker is on the visible side of the globe
        const gdistance = d3.geoDistance([marker.lng, marker.lat], [-rotation[0], -rotation[1]]);
        if (gdistance > Math.PI / 2) return;

        const color = marker.type === 'High' ? '#ef4444' : marker.type === 'Medium' ? '#f97316' : '#22c55e';

        // Pulse effect
        const pulse = markerGroup.append('circle')
          .attr('cx', coords[0])
          .attr('cy', coords[1])
          .attr('r', 8)
          .attr('fill', color)
          .attr('opacity', 0.3);

        function animatePulse() {
          pulse.transition()
            .duration(1500)
            .attr('r', 20)
            .attr('opacity', 0)
            .on('end', () => {
              pulse.attr('r', 8).attr('opacity', 0.3);
              animatePulse();
            });
        }
        animatePulse();

        // Main marker
        markerGroup.append('circle')
          .attr('cx', coords[0])
          .attr('cy', coords[1])
          .attr('r', 6)
          .attr('fill', color)
          .attr('stroke', '#fff')
          .attr('stroke-width', 2)
          .attr('class', 'cursor-pointer')
          .append('title')
          .text(`${marker.type} Risk: ${marker.count} cases`);

        // Label
        markerGroup.append('text')
          .attr('x', coords[0] + 10)
          .attr('y', coords[1] + 4)
          .text(marker.count)
          .attr('font-size', '10px')
          .attr('font-weight', 'bold')
          .attr('fill', '#1e293b');
      });
    });

    // Zoom and Drag behavior
    const zoom = d3.zoom()
      .scaleExtent([100, 1000])
      .on('zoom', (event) => {
        setScale(event.transform.k);
      });

    const drag = d3.drag()
      .on('drag', (event) => {
        const r = projection.rotate();
        const k = 75 / scale;
        setRotation([
          r[0] + event.dx * k,
          r[1] - event.dy * k,
          r[2]
        ]);
      });

    svg.call(zoom as any);
    svg.call(drag as any);

  }, [rotation, scale, markers]);

  return (
    <div className="w-full h-full relative overflow-hidden bg-blue-50/30">
      <svg 
        ref={svgRef} 
        className="w-full h-full cursor-move"
      />
      <div className="absolute bottom-6 left-6 bg-white/80 backdrop-blur-md p-3 rounded-xl border border-gray-200 shadow-sm text-[10px] font-bold text-gray-400 uppercase tracking-widest">
        Drag to rotate • Scroll to zoom
      </div>
    </div>
  );
};

export default WorldMap;
