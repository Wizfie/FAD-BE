import { AreaService } from "../services/areaService.js";

export class AreaController {
  static async list(_req, res) {
    const areas = await AreaService.list();
    res.json({ data: areas });
  }
}
