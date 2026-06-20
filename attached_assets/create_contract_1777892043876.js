const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, 
        Header, Footer, AlignmentType, PageNumber, BorderStyle, WidthType, 
        ShadingType, HeadingLevel } = require('docx');
const fs = require('fs');

const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border };

const doc = new Document({
    styles: {
        default: { document: { run: { font: "Arial", size: 22 } } },
        paragraphStyles: [
            { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
              run: { size: 32, bold: true, font: "Arial", color: "1F4E79" },
              paragraph: { spacing: { before: 300, after: 200 }, outlineLevel: 0 } },
            { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
              run: { size: 26, bold: true, font: "Arial", color: "2E7D32" },
              paragraph: { spacing: { before: 200, after: 150 }, outlineLevel: 1 } },
        ]
    },
    sections: [{
        properties: {
            page: { margin: { top: 1000, right: 1000, bottom: 1000, left: 1000 } }
        },
        headers: {
            default: new Header({ children: [new Paragraph({ 
                children: [new TextRun({ text: "CONTRATO DE SUMINISTRO - MODELO 2026", bold: true, size: 18, color: "666666" })],
                alignment: AlignmentType.CENTER
            })] })
        },
        footers: {
            default: new Footer({ children: [new Paragraph({
                children: [new TextRun({ text: "Página ", size: 18 }), new TextRun({ children: [PageNumber.CURRENT], size: 18 })],
                alignment: AlignmentType.CENTER
            })] })
        },
        children: [
            new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("CONTRATO DE SUMINISTRO DE PRODUCTOS Y SERVICIOS")] }),
            
            new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("1. PARTES CONTRATANTES")] }),
            new Paragraph({ children: [new TextRun("PROVEEDOR: [Nombre de la Empresa Proveedora], con CIF/NIF [Número], domiciliada en [Dirección Completa], representada por [Nombre del Representante], con DNI [Número].")] }),
            new Paragraph({ children: [new TextRun("CLIENTE: [Nombre del Hotel/Empresa], con CIF/NIF [Número], domiciliada en [Dirección Completa], representada por [Nombre del Representante], con DNI [Número].")] }),
            
            new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("2. OBJETO DEL CONTRATO")] }),
            new Paragraph({ children: [new TextRun("El Proveedor se compromete a suministrar al Cliente los productos y/o servicios detallados en el Anexo I (Lista de Productos y Precios), de acuerdo con las condiciones establecidas en el presente contrato.")] }),
            
            new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("3. PRECIO Y CONDICIONES ECONÓMICAS")] }),
            new Paragraph({ children: [new TextRun("3.1. Precios: Los precios unitarios son los establecidos en el Anexo I, con validez durante 12 meses desde la firma del contrato.")] }),
            new Paragraph({ children: [new TextRun("3.2. Descuentos por Volumen: Se aplicarán los descuentos establecidos en el Anexo I cuando se supere el volumen mínimo anual acordado.")] }),
            new Paragraph({ children: [new TextRun("3.3. Revisión de Precios: Los precios podrán revisarse anualmente, con un preaviso mínimo de 60 días.")] }),
            
            new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("4. FORMA Y PLAZO DE PAGO")] }),
            new Paragraph({ children: [new TextRun("4.1. Plazo de Pago: 30 días naturales desde la fecha de la factura.")] }),
            new Paragraph({ children: [new TextRun("4.2. Descuento por Pago Inmediato: 2% de descuento adicional si el pago se realiza en un plazo máximo de 7 días naturales.")] }),
            new Paragraph({ children: [new TextRun("4.3. Forma de Pago: Transferencia bancaria a la cuenta indicada por el Proveedor.")] }),
            
            new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("5. ENTREGA Y TRANSPORTE")] }),
            new Paragraph({ children: [new TextRun("5.1. Lugar de Entrega: Las instalaciones del Cliente en [Dirección].")] }),
            new Paragraph({ children: [new TextRun("5.2. Gastos de Transporte: Gratuitos a partir de 200€ de pedido. Para pedidos inferiores, se aplicará un cargo de 25€.")] }),
            new Paragraph({ children: [new TextRun("5.3. Plazo de Entrega: 24-48 horas desde la confirmación del pedido para productos en stock.")] }),
            
            new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("6. CALIDAD Y GARANTÍAS")] }),
            new Paragraph({ children: [new TextRun("6.1. Calidad: Todos los productos cumplirán con la normativa vigente y las especificaciones técnicas acordadas.")] }),
            new Paragraph({ children: [new TextRun("6.2. Devoluciones: El Cliente podrá devolver productos defectuosos o no conformes en un plazo de 15 días naturales.")] }),
            new Paragraph({ children: [new TextRun("6.3. Garantía: El Proveedor garantiza la calidad de los productos durante 12 meses desde la entrega.")] }),
            
            new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("7. DURACIÓN Y RESOLUCIÓN")] }),
            new Paragraph({ children: [new TextRun("7.1. Duración: El presente contrato tendrá una duración de 12 meses, prorrogable automáticamente por periodos anuales salvo denuncia expresa con 60 días de antelación.")] }),
            new Paragraph({ children: [new TextRun("7.2. Resolución: Cualquiera de las partes podrá resolver el contrato en caso de incumplimiento grave de las obligaciones establecidas.")] }),
            
            new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("8. PROTECCIÓN DE DATOS")] }),
            new Paragraph({ children: [new TextRun("Ambas partes se comprometen a cumplir con el Reglamento (UE) 2016/679 (RGPD) y la Ley Orgánica 3/2018, de Protección de Datos Personales y garantía de los derechos digitales.")] }),
            
            new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("9. JURISDICCIÓN Y LEGISLACIÓN APLICABLE")] }),
            new Paragraph({ children: [new TextRun("El presente contrato se rige por la legislación española. Para la resolución de cualquier controversia derivada del mismo, las partes se someten a los Juzgados y Tribunales de [Ciudad], con renuncia expresa a cualquier otro fuero que pudiera corresponderles.")] }),
            
            new Paragraph({ spacing: { before: 400 }, children: [new TextRun("En [Ciudad], a [Fecha] de [Mes] de 2026.")] }),
            new Paragraph({ spacing: { before: 300 }, children: [new TextRun("EL PROVEEDOR                                    EL CLIENTE")] }),
            new Paragraph({ spacing: { before: 200 }, children: [new TextRun("Firma: _________________                    Firma: _________________")] }),
            new Paragraph({ children: [new TextRun("Nombre: _________________                  Nombre: _________________")] }),
            new Paragraph({ children: [new TextRun("DNI/NIF: _________________                   DNI/NIF: _________________")] }),
        ]
    }]
});

Packer.toBuffer(doc).then(buffer => {
    fs.writeFileSync("Contrato_Modelo_Proveedor_2026.docx", buffer);
    console.log("Contrato creado exitosamente");
});
