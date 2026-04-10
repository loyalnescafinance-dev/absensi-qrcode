// ============================================
// PAYROLL REPORT - JavaScript
// ============================================

const BULAN_NAMES = [
    '', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

let reportData = null; // cache untuk export

// ==========================================
// INITIALIZATION
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    initFilters();
});

function initFilters() {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    // Set bulan
    document.getElementById('filterBulan').value = currentMonth;

    // Generate tahun (current - 2 sampai current + 1)
    const tahunSelect = document.getElementById('filterTahun');
    for (let y = currentYear + 1; y >= currentYear - 2; y--) {
        const option = document.createElement('option');
        option.value = y;
        option.textContent = y;
        if (y === currentYear) option.selected = true;
        tahunSelect.appendChild(option);
    }
}

// ==========================================
// LOAD REPORT
// ==========================================

async function loadReport() {
    const bulan = document.getElementById('filterBulan').value;
    const tahun = document.getElementById('filterTahun').value;

    // Show loading
    document.getElementById('emptyState').style.display = 'none';
    document.getElementById('reportSection').style.display = 'none';
    document.getElementById('summarySection').style.display = 'none';
    document.getElementById('loadingState').style.display = 'block';

    try {
        const url = `${APPS_SCRIPT_URL}?action=getPayrollReport&bulan=${bulan}&tahun=${tahun}`;
        console.log('Fetching payroll report:', url);

        const response = await fetch(url, { redirect: 'follow' });
        console.log('Response status:', response.status);
        console.log('Response url:', response.url);

        const responseText = await response.text();
        console.log('Raw response (first 500 chars):', responseText.substring(0, 500));

        let result;
        try {
            result = JSON.parse(responseText);
        } catch (parseErr) {
            console.error('JSON parse failed, trying to extract JSON from response...');
            // Sometimes Google returns HTML wrapper, try to find JSON in it
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                result = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('Server tidak mengembalikan JSON. Response: ' + responseText.substring(0, 200));
            }
        }

        console.log('Payroll data:', result);
        console.log('Data length:', result.data ? result.data.length : 'no data array');

        reportData = result;

        if (!result.data || result.data.length === 0) {
            document.getElementById('loadingState').style.display = 'none';
            document.getElementById('emptyState').style.display = 'block';
            document.querySelector('.empty-state h3').textContent = 'Tidak Ada Data';
            document.querySelector('.empty-state p').textContent =
                `Tidak ada data absensi untuk ${BULAN_NAMES[parseInt(bulan)]} ${tahun}`;
            return;
        }

        // Render
        renderSummary(result);
        renderTable(result);

        // Show report
        document.getElementById('loadingState').style.display = 'none';
        document.getElementById('summarySection').style.display = 'grid';
        document.getElementById('reportSection').style.display = 'block';

        // Update title
        document.getElementById('reportTitle').textContent =
            `Rekap ${BULAN_NAMES[parseInt(bulan)]} ${tahun}`;
        document.getElementById('reportGenerated').textContent =
            `Report di-generate: ${new Date().toLocaleString('id-ID')}`;

    } catch (error) {
        console.error('Error loading report:', error);
        console.error('Error details:', error.message);
        document.getElementById('loadingState').style.display = 'none';
        document.getElementById('emptyState').style.display = 'block';
        document.querySelector('.empty-state h3').textContent = 'Gagal Memuat Data';
        document.querySelector('.empty-state p').textContent = 'Error: ' + error.message;
    }
}

// ==========================================
// RENDER SUMMARY CARDS
// ==========================================

function renderSummary(result) {
    const data = result.data;

    let totalHadir = 0, totalSakit = 0, totalIzin = 0, totalAlfa = 0;

    data.forEach(row => {
        totalHadir += row.hadir;
        totalSakit += row.sakit;
        totalIzin += row.izin + row.cuti;
        totalAlfa += row.alfa;
    });

    document.getElementById('sumHadir').textContent = totalHadir;
    document.getElementById('sumSakit').textContent = totalSakit;
    document.getElementById('sumIzin').textContent = totalIzin;
    document.getElementById('sumAlfa').textContent = totalAlfa;
    document.getElementById('sumHariKerja').textContent = result.totalHariKerja;
    document.getElementById('sumKaryawan').textContent = data.length;
}

// ==========================================
// RENDER TABLE
// ==========================================

function renderTable(result) {
    const tbody = document.getElementById('tableBody');
    const data = result.data;

    let html = '';

    data.forEach((row, index) => {
        html += `
            <tr>
                <td class="cell-no">${index + 1}</td>
                <td class="cell-nama">${escapeHTML(row.nama)}</td>
                <td>${row.totalHariKerja}</td>
                <td class="cell-hadir">${row.hadir}</td>
                <td class="${row.sakit > 0 ? 'cell-sakit' : 'cell-zero'}">${row.sakit}</td>
                <td class="${row.izin > 0 ? 'cell-izin' : 'cell-zero'}">${row.izin}</td>
                <td class="${row.cuti > 0 ? 'cell-cuti' : 'cell-zero'}">${row.cuti}</td>
                <td class="${row.alfa > 0 ? 'cell-alfa' : 'cell-zero'}">${row.alfa}</td>
                <td class="cell-jam">${row.totalJamKerja}h</td>
                <td class="cell-jam">${row.rataRataJam}h</td>
                <td class="${row.terlambat > 0 ? 'cell-terlambat' : 'cell-zero'}">${row.terlambat}</td>
                <td class="${row.lembur > 0 ? 'cell-lembur' : 'cell-zero'}">${row.lembur}</td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

// ==========================================
// EXPORT CSV
// ==========================================

function exportCSV() {
    if (!reportData || !reportData.data) {
        alert('Tidak ada data untuk di-export');
        return;
    }

    const bulan = BULAN_NAMES[reportData.bulan];
    const tahun = reportData.tahun;

    // BOM for Excel UTF-8
    let csv = '\uFEFF';
    csv += `Rekap Kehadiran ${bulan} ${tahun}\n`;
    csv += `Hari Kerja: Senin-Sabtu | Jam Masuk: 08:00 WIB\n\n`;

    // Header
    csv += 'No,Nama,Hari Kerja,Hadir,Sakit,Izin,Cuti,Alfa,Total Jam,Rata-rata Jam,Terlambat,Lembur\n';

    // Data
    reportData.data.forEach((row, index) => {
        csv += [
            index + 1,
            `"${row.nama}"`,
            row.totalHariKerja,
            row.hadir,
            row.sakit,
            row.izin,
            row.cuti,
            row.alfa,
            row.totalJamKerja,
            row.rataRataJam,
            row.terlambat,
            row.lembur
        ].join(',') + '\n';
    });

    // Download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Rekap_Kehadiran_${bulan}_${tahun}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

// ==========================================
// PRINT
// ==========================================

function printReport() {
    window.print();
}

// ==========================================
// HELPERS
// ==========================================

function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
