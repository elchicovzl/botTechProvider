import { Controller, Get, Header, Res } from '@nestjs/common';
import { Response } from 'express';
import { join } from 'path';
import { Public } from '../common/decorators';

@Controller('widget')
@Public()
export class WidgetController {
  @Get('v1/widget.min.js')
  @Header('Content-Type', 'application/javascript')
  @Header('Cache-Control', 'public, max-age=3600')
  serveWidget(@Res() res: Response) {
    const filePath = join(process.cwd(), 'widget-dist', 'widget.min.js');
    res.sendFile(filePath, (err) => {
      if (err) res.status(404).json({ error: 'Widget not found' });
    });
  }
}
