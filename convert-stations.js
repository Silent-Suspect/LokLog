import fs from 'fs';
import readline from 'readline';

const inputFile = 'Betriebsstellen - Stations.csv';
const outputFile = 'stations.sql';
const BATCH_SIZE = 100; // Wir packen 100 Stationen in einen Befehl

async function processLineByLine() {
    const fileStream = fs.createReadStream(inputFile);

    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    const out = fs.createWriteStream(outputFile);

    // WICHTIG: Kein BEGIN TRANSACTION mehr!
    out.write("DELETE FROM stations;\n"); // Tabelle leeren

    let count = 0;
    let batch = [];

    for await (const line of rl) {
        // CSV Parsing (wie zuvor)
        const cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);

        if (cols.length < 2) continue;

        let code = cols[0] ? cols[0].replace(/"/g, '').trim() : '';
        let name = cols[1] ? cols[1].replace(/"/g, '').replace(/'/g, "''").trim() : '';
        let short = cols[2] ? cols[2].replace(/"/g, '').replace(/'/g, "''").trim() : '';

        let lat = cols[3] ? cols[3].replace(/"/g, '').replace(',', '.').trim() : 'NULL';
        let lng = cols[4] ? cols[4].replace(/"/g, '').replace(',', '.').trim() : 'NULL';

        if (!lat || isNaN(parseFloat(lat))) lat = 'NULL';
        if (!lng || isNaN(parseFloat(lng))) lng = 'NULL';

        if (code) {
            // Statt schreiben, pushen wir in den Batch
            batch.push(`('${code}', '${name}', '${short}', ${lat}, ${lng})`);
            count++;
        }

        // Wenn Batch voll ist -> schreiben
        if (batch.length >= BATCH_SIZE) {
            out.write(`INSERT INTO stations (code, name, short_name, lat, lng) VALUES ${batch.join(',')};\n`);
            batch = [];
        }
    }

    // Den Rest schreiben
    if (batch.length > 0) {
        out.write(`INSERT INTO stations (code, name, short_name, lat, lng) VALUES ${batch.join(',')};\n`);
    }

    console.log(`Fertig! ${count} Stationen wurden in ${outputFile} geschrieben (Optimiert).`);
}

processLineByLine();