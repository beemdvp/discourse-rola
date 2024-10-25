import { DataTypes, Sequelize } from "sequelize";

export const sequelize = new Sequelize(process.env.DATABASE_URL!);

export const RolaUser = sequelize.define("RolaUser", {
  identity_address: DataTypes.STRING,
  username: DataTypes.STRING,
  password: DataTypes.STRING,
});
