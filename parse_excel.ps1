$excelPath = "J:\Logistics\Shared Folder\Logs\2025\IMPORT TRACKING LOG 2025.xlsx"
$outputPath = "C:\Users\nader.khaled\.gemini\antigravity\scratch\edc-logistics-react\public\shipments.json"

Write-Host "Opening Excel Application..."
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false

Write-Host "Opening Workbook $excelPath..."
$workbook = $excel.Workbooks.Open($excelPath)
$sheet = $workbook.Sheets.Item(1)
$usedRange = $sheet.UsedRange

Write-Host "Reading sheet values..."
$values = $usedRange.Value2

Write-Host "Closing Workbook..."
$workbook.Close($false)
$excel.Quit()
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null

$rowCount = $values.GetLength(0)
$colCount = $values.GetLength(1)
Write-Host "Rows to parse: $($rowCount - 1)"

function Get-FormattedDate($val) {
    if (-not $val) { return "" }
    $numericValue = 0.0
    if ([double]::TryParse($val.ToString(), [ref]$numericValue)) {
        if ($numericValue -gt 0) {
            try {
                $dt = [System.DateTime]::FromOADate($numericValue)
                return $dt.ToString("yyyy-MM-dd")
            } catch {}
        }
    }
    $strVal = $val.ToString().Trim()
    if ($strVal -eq "") { return "" }
    $parsedDate = [DateTime]::MinValue
    if ([DateTime]::TryParse($strVal, [ref]$parsedDate)) {
        return $parsedDate.ToString("yyyy-MM-dd")
    }
    return $strVal
}

function Get-FormattedNumber($val) {
    if (-not $val) { return 0 }
    $num = 0.0
    if ([double]::TryParse($val.ToString(), [ref]$num)) {
        if ($num -lt 0) {
            return 0
        }
        return $num
    }
    return 0
}

function Get-CleanString($val) {
    if (-not $val) { return "" }
    # Remove trailing .0 from reference numbers
    $str = $val.ToString().Trim()
    if ($str.EndsWith(".0")) {
        $prefix = $str.Substring(0, $str.Length - 2)
        $temp = $prefix
        $valTemp = 0
        if ([int]::TryParse($temp, [ref]$valTemp) -or $temp -match "^\d+$" -or $temp -eq "") {
            return $prefix
        }
    }
    return $str
}

$shipments = @()

# Loop through all rows skipping headers
for ($row = 2; $row -le $rowCount; $row++) {
    $mrNo = Get-CleanString $values.GetValue($row, 1)
    $bl = Get-CleanString $values.GetValue($row, 7)
    if ($mrNo -eq "" -and $bl -eq "") {
        continue
    }
    
    $status = Get-CleanString $values.GetValue($row, 2)
    if ($status -eq "") { $status = "Doc. Received" }
    
    $shipment = [Ordered]@{
        id = $row - 1
        mrNo = $mrNo
        status = $status
        statusDate = Get-FormattedDate $values.GetValue($row, 3)
        supplier = Get-CleanString $values.GetValue($row, 4)
        vesselName = Get-CleanString $values.GetValue($row, 5)
        shippingLine = Get-CleanString $values.GetValue($row, 6)
        bl = $bl
        acidNo = Get-CleanString $values.GetValue($row, 8)
        freightType = Get-CleanString $values.GetValue($row, 9)
        portOfOrigin = Get-CleanString $values.GetValue($row, 10)
        finalDestination = Get-CleanString $values.GetValue($row, 11)
        freightForwarderForeign = Get-CleanString $values.GetValue($row, 12)
        etd = Get-FormattedDate $values.GetValue($row, 13)
        eta1 = Get-FormattedDate $values.GetValue($row, 14)
        eta2 = Get-FormattedDate $values.GetValue($row, 15)
        eta3 = Get-FormattedDate $values.GetValue($row, 16)
        finalEta = Get-FormattedDate $values.GetValue($row, 17)
        containerType = Get-CleanString $values.GetValue($row, 18)
        lcl = Get-CleanString $values.GetValue($row, 19)
        container20 = Get-FormattedNumber $values.GetValue($row, 20)
        container40 = Get-FormattedNumber $values.GetValue($row, 21)
        pkg = Get-CleanString $values.GetValue($row, 22)
        totalWeight = Get-FormattedNumber $values.GetValue($row, 23)
        containerNo = Get-CleanString $values.GetValue($row, 24)
        shipmentRef = Get-CleanString $values.GetValue($row, 25)
        entityShipmentNo = Get-CleanString $values.GetValue($row, 26)
        oraclePo = Get-CleanString $values.GetValue($row, 27)
        prNo = Get-CleanString $values.GetValue($row, 28)
        valueInFc = Get-FormattedNumber $values.GetValue($row, 29)
        fcCurrency = Get-CleanString $values.GetValue($row, 30)
        materialDescription = Get-CleanString $values.GetValue($row, 31)
        contractor = Get-CleanString $values.GetValue($row, 32)
        sentToOperatorDate = Get-FormattedDate $values.GetValue($row, 33)
        recvFromOperatorDate = Get-FormattedDate $values.GetValue($row, 34)
        freightForwarderLocal = Get-CleanString $values.GetValue($row, 35)
        sentToFfwDate = Get-FormattedDate $values.GetValue($row, 36)
        deliveryPlace = Get-CleanString $values.GetValue($row, 37)
        releasingDate = Get-FormattedDate $values.GetValue($row, 38)
        kpiDate = Get-FormattedDate $values.GetValue($row, 39)
        clearancePeriod = Get-FormattedNumber $values.GetValue($row, 40)
        originalCustomDeclRecv = Get-CleanString $values.GetValue($row, 41)
        rigNo = Get-CleanString $values.GetValue($row, 42)
        customDeclNo = Get-CleanString $values.GetValue($row, 43)
        customDeclDate = Get-FormattedDate $values.GetValue($row, 44)
        customDeclValue = Get-FormattedNumber $values.GetValue($row, 45)
        customCertNo = Get-CleanString $values.GetValue($row, 46)
        customReceiptNo = Get-CleanString $values.GetValue($row, 47)
        customReceiptDate = Get-FormattedDate $values.GetValue($row, 48)
        localInvoiceNo = Get-CleanString $values.GetValue($row, 49)
        totalLocalChargesEgp = Get-FormattedNumber $values.GetValue($row, 50)
        totalLocalChargesCca = Get-FormattedNumber $values.GetValue($row, 51)
        demurrageInvoiceNo = Get-CleanString $values.GetValue($row, 52)
        demurrageValue = Get-FormattedNumber $values.GetValue($row, 53)
        foreignInvoiceNo = Get-CleanString $values.GetValue($row, 54)
        receivingDate = Get-FormattedDate $values.GetValue($row, 55)
        foreignInvoiceValue = Get-FormattedNumber $values.GetValue($row, 56)
        localChargesUsd = Get-FormattedNumber $values.GetValue($row, 57)
        finalShipmentChargesUsd = Get-FormattedNumber $values.GetValue($row, 58)
        costRig = Get-FormattedNumber $values.GetValue($row, 59)
        prRig = Get-CleanString $values.GetValue($row, 60)
        remarks = Get-CleanString $values.GetValue($row, 61)
    }
    
    $shipments += $shipment
}

Write-Host "Converting parsed shipments to JSON..."
$json = ConvertTo-Json -InputObject $shipments -Depth 5

Write-Host "Saving to $outputPath..."
[System.IO.File]::WriteAllText($outputPath, $json)
Write-Host "Successfully exported $($shipments.Length) shipments!"
