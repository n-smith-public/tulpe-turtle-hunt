let lineChartData = [];
let lodgeChart = null;
let pronounsChart = null;
let deviceChart = null;

const refreshCharts = () => {
    // Clear line chart data
    lineChartData = [];
    // Render all charts
    renderChart('line-chart');
    renderChart('lodge-chart');
    renderChart('pronouns-chart');
    renderChart('device-chart');
};


// Helper function to get chart name for button text
function getChartName(chartId) {
    switch (chartId) {
        case 'line-chart':
            return 'Line';
        case 'lodge-chart':
            return 'Lodge';
        case 'pronouns-chart':
            return 'Pronouns';
        case 'device-chart':
            return 'Device';
        default:
            return '';
    }
}

// Function to fetch data from API endpoints
const fetchData = async (endpoint) => {
    try {
        const response = await fetch(endpoint);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log(`Data fetched from ${endpoint}:`, data);
        return data;
    } catch (error) {
        console.error(`Failed to fetch data from ${endpoint}:`, error);
        return [];
    }
};

// Function to render or update chart
// Function to render or update chart
const renderChart = async (chartId) => {
    let chartInstance = null;
    let endpoint = '';

    switch (chartId) {
        case 'line-chart':
            endpoint = '/query-people-count-by-date';
            break;
        case 'lodge-chart':
            endpoint = '/query-lodge-data';
            break;
        case 'pronouns-chart':
            endpoint = '/query-pronouns-data';
            break;
        case 'device-chart':
            endpoint = '/query-device-data';
            break;
        default:
            return;
    }

    const data = await fetchData(endpoint);
    if (data.length === 0) return;

    const ctx = document.getElementById(chartId).getContext('2d');
    let labels = [];
    let counts = [];

    switch (chartId) {
        case 'line-chart':
            // Line chart needs to maintain previous data for a gradually increasing line
            lineChartData.push(...data); // Append new data to global variable
            lineChartData.sort((a, b) => new Date(a.Date) - new Date(b.Date)); // Sort by Date
            
            // Update labels and counts for line chart
            labels = lineChartData.map(entry => entry.Date);
            counts = lineChartData.map(entry => entry.Count);

            break;
        case 'lodge-chart':
            // Lodge chart may have multiple entries, so we map them
            labels = data.map(entry => entry.Lodge);
            counts = data.map(entry => entry.Count);
            break;
        case 'pronouns-chart':
        case 'device-chart':
            // Pronouns and Device charts should have labels and counts
            labels = data.map(entry => entry.Label || entry.Pronouns || entry['Device Data']);
            counts = data.map(entry => entry.Count);
            break;
        default:
            return;
    }

    // Check if there is only one label
    const uniqueLabels = new Set(labels);
    const isSingleType = uniqueLabels.size === 1;
    
    if (chartInstance) {
        chartInstance.data.labels = labels;
        chartInstance.data.datasets[0].data = counts;
        if (chartInstance.config.type !== 'pie') {
            chartInstance.options.plugins.legend.display = !isSingleType;
        }
        chartInstance.update();
    } else {
        chartInstance = new Chart(ctx, {
            type: chartId === 'line-chart' ? 'line' : 'pie',
            data: {
                labels: labels,
                datasets: [{
                    data: counts,
                    backgroundColor: [
                        'rgba(255, 99, 132, 0.2)',
                        'rgba(54, 162, 235, 0.2)',
                        'rgba(255, 206, 86, 0.2)',
                        'rgba(75, 192, 192, 0.2)',
                        'rgba(153, 102, 255, 0.2)',
                        'rgba(255, 159, 64, 0.2)'
                    ],
                    borderColor: [
                        'rgba(255, 99, 132, 1)',
                        'rgba(54, 162, 235, 1)',
                        'rgba(255, 206, 86, 1)',
                        'rgba(75, 192, 192, 1)',
                        'rgba(153, 102, 255, 1)',
                        'rgba(255, 159, 64, 1)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        display: chartId !== 'line-chart' && !isSingleType, // Display legend for pie chart only if there are multiple types
                        position: 'top'
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.dataset.label || '';
                            if (context.parsed.y !== null) {
                                return label + new Date(context.raw.x).toLocaleDateString('en-GB') + ' - ' + context.parsed.y;
                            }
                            return '';
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'day',
                            displayFormats: {
                                day: 'MMM d' // Adjusted display format for day
                            }
                        },
                        title: {
                            display: true,
                            text: 'Date'
                        }
                    }
                }
            }
        });
    }
    
};

const populateDataTable = async () => {
    const endpoint = '/query-all-user-data'; // Backend endpoint for fetching data
    const data = await fetchData(endpoint);

    if (data.length === 0) {
        console.log('No data fetched.');
        return;
    }

    const tableBody = document.querySelector('.data-table tbody');
    tableBody.innerHTML = ''; // Clear existing table rows

    data.forEach(entry => {
        const row = document.createElement('tr');
        Object.values(entry).forEach(value => {
            const cell = document.createElement('td');
            cell.textContent = value;
            row.appendChild(cell);
        });
        tableBody.appendChild(row);
    });
};

// Function to initialize the side panel and data table
const initializeSidePanel = () => {
    populateDataTable(); // Populate the data table on load
};


// Function to initialize the charts
const initializeCharts = async () => {
    await renderChart('line-chart');
    await renderChart('lodge-chart');
    await renderChart('pronouns-chart');
    await renderChart('device-chart');
};

document.addEventListener('DOMContentLoaded', () => {
    initializeCharts();
    initializeSidePanel();

    document.getElementById('refresh-button').addEventListener('click', refreshCharts);
});
