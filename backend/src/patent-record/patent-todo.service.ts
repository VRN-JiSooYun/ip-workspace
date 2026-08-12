import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import type {
  CreatePatentTodoDto,
  UpdatePatentTodoDto,
} from "./dto/patent-todo.dto";

const trimmedOrNull = (value: string | null | undefined) => {
  if (value === undefined || value === null) return value;
  return value.trim() || null;
};

const toDate = (value: string | null | undefined) => {
  if (value === undefined || value === null) return value;
  return new Date(value);
};

const TODO_PUBLIC_SELECT = {
  id: true,
  patentId: true,
  title: true,
  description: true,
  dueDate: true,
  completed: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class PatentTodoService {
  constructor(private readonly prisma: PrismaService) {}

  async list(patentId: number) {
    await this.assertPatentExists(patentId);
    return this.prisma.client.patentTodo.findMany({
      where: { patentId },
      select: TODO_PUBLIC_SELECT,
      orderBy: [
        { completed: "asc" },
        { dueDate: { sort: "asc", nulls: "last" } },
        { id: "desc" },
      ],
    });
  }

  async create(dto: CreatePatentTodoDto) {
    await this.assertPatentExists(dto.patentId);
    const title = dto.title.trim();
    if (!title) throw new BadRequestException("PATENT_TODO_TITLE_REQUIRED");
    return this.prisma.client.patentTodo.create({
      data: {
        patentId: dto.patentId,
        title,
        description: trimmedOrNull(dto.description) ?? null,
        dueDate: toDate(dto.dueDate) ?? null,
      },
      select: TODO_PUBLIC_SELECT,
    });
  }

  async update(id: number, dto: UpdatePatentTodoDto) {
    const existing = await this.get(id);
    const title = dto.title?.trim();
    if (dto.title !== undefined && !title) {
      throw new BadRequestException("PATENT_TODO_TITLE_REQUIRED");
    }
    return this.prisma.client.patentTodo.update({
      where: { id },
      data: {
        ...(title !== undefined ? { title } : {}),
        ...(dto.description !== undefined
          ? { description: trimmedOrNull(dto.description) }
          : {}),
        ...(dto.dueDate !== undefined ? { dueDate: toDate(dto.dueDate) } : {}),
        ...(dto.completed !== undefined
          ? {
              completed: dto.completed,
              completedAt: dto.completed
                ? (existing.completedAt ?? new Date())
                : null,
            }
          : {}),
      },
      select: TODO_PUBLIC_SELECT,
    });
  }

  async remove(id: number) {
    await this.get(id);
    await this.prisma.client.patentTodo.delete({ where: { id } });
    return { id };
  }

  private async get(id: number) {
    const todo = await this.prisma.client.patentTodo.findUnique({
      where: { id },
    });
    if (!todo) throw new NotFoundException("PATENT_TODO_NOT_FOUND");
    return todo;
  }

  private async assertPatentExists(patentId: number) {
    const patent = await this.prisma.client.patent.findUnique({
      where: { id: patentId },
      select: { id: true },
    });
    if (!patent) throw new NotFoundException("PATENT_RECORD_NOT_FOUND");
  }
}
