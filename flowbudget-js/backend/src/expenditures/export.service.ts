import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { DataSource } from 'typeorm';
import { BudgetService } from '../domain/budget.service.js';
import { OwnershipService } from '../domain/ownership.service.js';
import type { ExpenditureDto } from './expenditures.dto.js';
import { ExpendituresService } from './expenditures.service.js';

export const EXPORT_FORMATS = ['CSV', 'TXT', 'JSON', 'EXCEL'] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export interface ExportParams {
  accountId: string;
  format: ExportFormat;
  from: string;
  to: string;
  categoryIds: string[];
  pocketIds: string[];
  separator?: string;
}

const HEADERS = ['Date', 'Name', 'Price', 'Currency', 'Category', 'Description'];

const FILE_TYPES: Record<ExportFormat, { contentType: string; extension: string }> = {
  CSV: { contentType: 'text/csv; charset=utf-8', extension: 'csv' },
  TXT: { contentType: 'text/plain; charset=utf-8', extension: 'txt' },
  JSON: { contentType: 'application/json; charset=utf-8', extension: 'json' },
  EXCEL: { contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', extension: 'xlsx' },
};

@Injectable()
export class ExportService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly ownership: OwnershipService,
    private readonly budget: BudgetService,
    private readonly expenditures: ExpendituresService,
  ) {}

  async export(userId: string, params: ExportParams): Promise<{ buffer: Buffer; contentType: string; fileName: string }> {
    const account = await this.ownership.account(userId, params.accountId);
    const rows = await this.load(userId, params);
    const buffer = await this.render(params, rows, account.currencyCode);
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
    const { contentType, extension } = FILE_TYPES[params.format];
    return { buffer, contentType, fileName: `flowbudget-export-${stamp}.${extension}` };
  }

  private async load(userId: string, params: ExportParams): Promise<ExpenditureDto[]> {
    const em = this.dataSource.manager;
    const qb = this.expenditures
      .baseQuery(em, userId)
      .andWhere('account.id = :accountId', { accountId: params.accountId })
      .andWhere('e.date BETWEEN :from AND :to', { from: params.from, to: params.to })
      .orderBy('e.date', 'ASC')
      .addOrderBy('e.createdAt', 'ASC');

    if (params.categoryIds.length > 0) qb.andWhere('e.categoryId IN (:...categoryIds)', { categoryIds: params.categoryIds });
    // Pockets are versioned; selecting a pocket exports every version of it.
    if (params.pocketIds.length > 0) {
      const pocketIds = await this.budget.pocketIdsOfLineages(em, params.pocketIds);
      qb.andWhere('pocket.id IN (:...pocketIds)', { pocketIds });
    }
    return this.expenditures.toDtos(userId, (await qb.getMany()) as Parameters<ExpendituresService['toDtos']>[1]);
  }

  private async render(params: ExportParams, rows: ExpenditureDto[], currency: string): Promise<Buffer> {
    const values = rows.map((e) => [e.date, e.name, e.price, currency, e.category?.name ?? '-', e.description ?? '']);

    switch (params.format) {
      case 'CSV':
        return withBom([HEADERS, ...values].map((r) => r.map(csvCell).join(',')).join('\r\n'));
      case 'TXT': {
        const separator = params.separator || '|';
        return withBom([HEADERS, ...values].map((r) => r.join(separator)).join('\n'));
      }
      case 'JSON':
        return Buffer.from(
          JSON.stringify(
            values.map(([Date, Name, Price, Currency, Category, Description]) => ({ Date, Name, Price, Currency, Category, Description })),
            null,
            2,
          ),
        );
      case 'EXCEL':
        return this.excel(values);
    }
  }

  private async excel(values: (string | number)[][]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Expenditures');
    sheet.columns = HEADERS.map((header) => ({ header, width: Math.max(12, header.length + 2) }));
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } };
    for (const [date, ...rest] of values) {
      const row = sheet.addRow([new Date(`${date}T00:00:00Z`), ...rest]);
      row.getCell(1).numFmt = 'yyyy-mm-dd';
    }
    sheet.columns.forEach((column) => {
      let width = 12;
      column.eachCell?.({ includeEmpty: false }, (cell) => {
        width = Math.max(width, Math.min(60, String(cell.value ?? '').length + 2));
      });
      column.width = width;
    });
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }
}

const withBom = (text: string) => Buffer.from(`﻿${text}`, 'utf8');

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
