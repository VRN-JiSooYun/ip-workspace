import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { RequirePermissions } from "../authorization/require-permissions.decorator";
import {
  CreatePatentTodoDto,
  PatentTodoListQueryDto,
  UpdatePatentTodoDto,
} from "./dto/patent-todo.dto";
import { PatentTodoService } from "./patent-todo.service";

@RequirePermissions("patentAnalysis.read")
@Controller("api/patent-todos")
export class PatentTodoController {
  constructor(private readonly todos: PatentTodoService) {}

  @Get()
  list(@Query() query: PatentTodoListQueryDto) {
    return this.todos.list(query.patentId);
  }

  @RequirePermissions("patentAnalysis.manage")
  @Post()
  create(@Body() body: CreatePatentTodoDto) {
    return this.todos.create(body);
  }

  @RequirePermissions("patentAnalysis.manage")
  @Patch(":id")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() body: UpdatePatentTodoDto,
  ) {
    return this.todos.update(id, body);
  }

  @RequirePermissions("patentAnalysis.manage")
  @Delete(":id")
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.todos.remove(id);
  }
}
