// src/App.tsx

import { useState, useCallback } from "react";
import "./App.css";

interface TroubleCondition {
	unitName: string;
	troubleCondition: string;
	startDate: string;
	deviceType: string;
	deviceName: string;
}

function App() {
	const [hubIssues, setHubIssues] = useState<TroubleCondition[]>([]);
	const [lockIssues, setLockIssues] = useState<TroubleCondition[]>([]);
	const [fileName, setFileName] = useState<string>("");
	const [error, setError] = useState<string>("");
	const [isProcessing, setIsProcessing] = useState(false);

	const parseCSV = (text: string): string[][] => {
		const lines: string[][] = [];
		let currentLine: string[] = [];
		let currentField = "";
		let inQuotes = false;

		for (let i = 0; i < text.length; i++) {
			const char = text[i];
			const nextChar = text[i + 1];

			if (inQuotes) {
				if (char === '"' && nextChar === '"') {
					currentField += '"';
					i++;
				} else if (char === '"') {
					inQuotes = false;
				} else {
					currentField += char;
				}
			} else {
				if (char === '"') {
					inQuotes = true;
				} else if (char === ",") {
					currentLine.push(currentField);
					currentField = "";
				} else if (char === "\n" || (char === "\r" && nextChar === "\n")) {
					currentLine.push(currentField);
					if (currentLine.length > 1 || currentLine[0] !== "") {
						lines.push(currentLine);
					}
					currentLine = [];
					currentField = "";
					if (char === "\r") i++;
				} else if (char !== "\r") {
					currentField += char;
				}
			}
		}

		if (currentField || currentLine.length > 0) {
			currentLine.push(currentField);
			if (currentLine.length > 1 || currentLine[0] !== "") {
				lines.push(currentLine);
			}
		}

		return lines;
	};

	const processFile = useCallback((content: string) => {
		setIsProcessing(true);
		setError("");

		try {
			const lines = parseCSV(content);

			// Find the header row (the one with "Unit Name", "Trouble Condition", etc.)
			let headerIndex = -1;
			for (let i = 0; i < lines.length; i++) {
				const line = lines[i];
				if (
					line.some((cell) => cell.toLowerCase().includes("unit name")) &&
					line.some((cell) => cell.toLowerCase().includes("trouble condition"))
				) {
					headerIndex = i;
					break;
				}
			}

			if (headerIndex === -1) {
				setError("Could not find the header row in the file.");
				setIsProcessing(false);
				return;
			}

			const headers = lines[headerIndex].map((h) => h.toLowerCase().trim());
			const dataLines = lines.slice(headerIndex + 1);

			// Find column indices
			const unitNameIdx = headers.findIndex((h) => h.includes("unit name"));
			const troubleConditionIdx = headers.findIndex(
				(h) => h === "trouble condition" || h === "trouble condition"
			);
			const startDateIdx = headers.findIndex((h) =>
				h.includes("trouble condition start date")
			);
			const deviceTypeIdx = headers.findIndex((h) =>
				h.includes("affected device type")
			);
			const deviceNameIdx = headers.findIndex((h) =>
				h.includes("affected device name")
			);

			if (
				unitNameIdx === -1 ||
				troubleConditionIdx === -1 ||
				startDateIdx === -1 ||
				deviceTypeIdx === -1 ||
				deviceNameIdx === -1
			) {
				setError(
					"Could not find all required columns. Please ensure the file has: Unit Name, Trouble Condition, Trouble Condition Start Date, Affected Device Type, and Affected Device Name columns."
				);
				setIsProcessing(false);
				return;
			}

			const hubList: TroubleCondition[] = [];
			const lockList: TroubleCondition[] = [];

			for (const row of dataLines) {
				if (row.length <= Math.max(unitNameIdx, troubleConditionIdx, startDateIdx, deviceTypeIdx, deviceNameIdx)) {
					continue;
				}

				const unitName = row[unitNameIdx]?.trim() || "";
				const troubleCondition = row[troubleConditionIdx]?.trim() || "";
				const startDate = row[startDateIdx]?.trim() || "";
				const deviceType = row[deviceTypeIdx]?.trim() || "";
				const deviceName = row[deviceNameIdx]?.trim() || "";

				// Skip empty rows
				if (!unitName && !troubleCondition) continue;

				// Skip Dual-Path Communication Failure entries
				if (
					troubleCondition.toLowerCase().includes("dual-path communication failure")
				) {
					continue;
				}

				const record: TroubleCondition = {
					unitName,
					troubleCondition,
					startDate,
					deviceType,
					deviceName,
				};

				// Column I (Affected Device Name) - sort by "Panel" for Hub Issues
				if (deviceName.toLowerCase() === "panel") {
					hubList.push(record);
				} else {
					lockList.push(record);
				}
			}

			// Sort by date (most recent first)
			const sortByDate = (a: TroubleCondition, b: TroubleCondition) => {
				const dateA = new Date(a.startDate);
				const dateB = new Date(b.startDate);
				return dateB.getTime() - dateA.getTime();
			};

			setHubIssues(hubList.sort(sortByDate));
			setLockIssues(lockList.sort(sortByDate));
		} catch (err) {
			setError(`Error processing file: ${err instanceof Error ? err.message : "Unknown error"}`);
		}

		setIsProcessing(false);
	}, []);

	const handleFileUpload = useCallback(
		(event: React.ChangeEvent<HTMLInputElement>) => {
			const file = event.target.files?.[0];
			if (!file) return;

			setFileName(file.name);
			setHubIssues([]);
			setLockIssues([]);

			const reader = new FileReader();
			reader.onload = (e) => {
				const content = e.target?.result as string;
				processFile(content);
			};
			reader.onerror = () => {
				setError("Error reading file");
			};
			reader.readAsText(file);
		},
		[processFile]
	);

	const handleDrop = useCallback(
		(event: React.DragEvent<HTMLDivElement>) => {
			event.preventDefault();
			event.stopPropagation();

			const file = event.dataTransfer.files?.[0];
			if (!file) return;

			if (!file.name.endsWith(".csv") && !file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
				setError("Please upload a CSV or Excel file");
				return;
			}

			setFileName(file.name);
			setHubIssues([]);
			setLockIssues([]);

			const reader = new FileReader();
			reader.onload = (e) => {
				const content = e.target?.result as string;
				processFile(content);
			};
			reader.onerror = () => {
				setError("Error reading file");
			};
			reader.readAsText(file);
		},
		[processFile]
	);

	const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
		event.preventDefault();
		event.stopPropagation();
	};

	const clearData = () => {
		setHubIssues([]);
		setLockIssues([]);
		setFileName("");
		setError("");
	};

	return (
		<div className="app-container">
			<header className="app-header">
				<h1>🏠 Trouble Condition Analyzer</h1>
				<p className="subtitle">Upload your trouble condition report to analyze hub and lock issues</p>
			</header>

			<div
				className="upload-section"
				onDrop={handleDrop}
				onDragOver={handleDragOver}
			>
				<div className="upload-box">
					<div className="upload-icon">📁</div>
					<p>Drag and drop your CSV or Excel file here</p>
					<p className="or-text">or</p>
					<label className="file-input-label">
						<input
							type="file"
							accept=".csv,.xlsx,.xls"
							onChange={handleFileUpload}
							className="file-input"
						/>
						Browse Files
					</label>
					{fileName && (
						<div className="file-info">
							<span className="file-name">📄 {fileName}</span>
							<button onClick={clearData} className="clear-btn">
								✕ Clear
							</button>
						</div>
					)}
				</div>
			</div>

			{error && <div className="error-message">⚠️ {error}</div>}

			{isProcessing && (
				<div className="processing">
					<div className="spinner"></div>
					<p>Processing file...</p>
				</div>
			)}

			{(hubIssues.length > 0 || lockIssues.length > 0) && (
				<div className="results-container">
					<div className="results-summary">
						<div className="summary-card hub">
							<span className="count">{hubIssues.length}</span>
							<span className="label">Hub Issues</span>
						</div>
						<div className="summary-card lock">
							<span className="count">{lockIssues.length}</span>
							<span className="label">Lock Issues</span>
						</div>
					</div>

					<div className="tables-container">
						<div className="table-section">
							<h2>🖥️ Hub Issues</h2>
							<p className="table-description">
								Panel-related issues (excluding Dual-Path Communication Failures)
							</p>
							{hubIssues.length > 0 ? (
								<div className="table-wrapper">
									<table>
										<thead>
											<tr>
												<th>Unit Name</th>
												<th>Trouble Condition</th>
												<th>Start Date</th>
												<th>Device Type</th>
											</tr>
										</thead>
										<tbody>
											{hubIssues.map((issue, index) => (
												<tr key={index}>
													<td>{issue.unitName}</td>
													<td>{issue.troubleCondition}</td>
													<td>{issue.startDate}</td>
													<td>{issue.deviceType}</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							) : (
								<p className="no-data">No hub issues found</p>
							)}
						</div>

						<div className="table-section">
							<h2>🔐 Lock Issues</h2>
							<p className="table-description">
								Non-panel device issues (excluding Dual-Path Communication Failures)
							</p>
							{lockIssues.length > 0 ? (
								<div className="table-wrapper">
									<table>
										<thead>
											<tr>
												<th>Unit Name</th>
												<th>Trouble Condition</th>
												<th>Start Date</th>
												<th>Device Type</th>
											</tr>
										</thead>
										<tbody>
											{lockIssues.map((issue, index) => (
												<tr key={index}>
													<td>{issue.unitName}</td>
													<td>{issue.troubleCondition}</td>
													<td>{issue.startDate}</td>
													<td>{issue.deviceType}</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							) : (
								<p className="no-data">No lock issues found</p>
							)}
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

export default App;
