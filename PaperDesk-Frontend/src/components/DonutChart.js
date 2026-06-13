// components/DonutChart.js
import React from "react";
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip } from "chart.js";

ChartJS.register(ArcElement, Tooltip);

const DonutChart = ({ value, label, color }) => {
  const data = {
    labels: [label, ""],
    datasets: [
      {
        data: [value, 100 - value],
        backgroundColor: [color, "#e5e7eb"],
        borderWidth: 0,
      },
    ],
  };

  const options = {
    cutout: "75%",
    animation: {
      animateRotate: true,
      duration: 4000,
    },
    plugins: {
      tooltip: { enabled: true },
    },
  };

  return (
    <div className="relative w-52 h-52">
      <Doughnut data={data} options={options} />
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-lg font-bold">{value}%</span>
      </div>
    </div>
  );
};

export default DonutChart;
