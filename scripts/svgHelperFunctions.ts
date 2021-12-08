import { Signer } from "@ethersproject/abstract-signer";
import { BigNumberish } from "@ethersproject/bignumber";
import { BytesLike } from "@ethersproject/bytes";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { SvgFacet } from "../typechain";
import {
  gasPrice,
  itemManager,
  maticRealmDiamondAddress,
} from "./helperFunctions";

import { wearablesSvgs as front } from "../svgs/wearables";
import {
  wearablesLeftSvgs as left,
  wearablesRightSvgs as right,
  wearablesBackSvgs as back,
  wearablesLeftSleeveSvgs as leftSleeve,
  wearablesRightSleeveSvgs as rightSleeve,
  wearablesBackSleeveSvgs as backSleeve,
} from "../svgs/wearables-sides";
import { UpdateSvgsTaskArgs } from "../tasks/updateSvgs";
import { AddItemTypesTaskArgs } from "../tasks/addBaadgeSvgs";
import { AirdropBaadgeTaskArgs } from "../tasks/baadgeAirdrop";
const fs = require("fs");
import { SleeveObject, ItemTypeInputNew } from "./itemTypeHelpers";

export interface SvgTypesAndSizes {
  svgType: BytesLike;
  sizes: BigNumberish[];
}

export interface SvgTypesAndSizesOutput {
  svg: string;
  svgTypesAndSizes: SvgTypesAndSizes[];
}

export function setupSvg(
  svgType: string,
  svgs: string[],
  ethers: any
): SvgTypesAndSizesOutput {
  const svgTypesAndSizes: SvgTypesAndSizes[] = [];
  const svgItems = [];

  svgItems.push(svgs.join(""));
  svgTypesAndSizes.push({
    svgType: ethers.utils.formatBytes32String(svgType),
    sizes: svgs.map((value: string) => value.length),
  });

  return {
    svg: svgItems.join(""),
    svgTypesAndSizes: svgTypesAndSizes,
  };

  // return [svgItems.join(""), svgTypesAndSizes];
}

export function printSizeInfo(
  svgType: string,
  sizes: BigNumberish[]
  // ethers: any
) {
  console.log("------------- SVG Size Info ---------------");
  let totalSize = 0;
  for (const size of sizes) {
    console.log(svgType + ":" + size);
    // for (const nextSize of size) {
    totalSize += Number(size.toString());
    // }
  }
  console.log("Total sizes:" + sizes);
}

export function stripSvg(svg: string) {
  // removes svg tag
  if (svg.includes("viewBox")) {
    svg = svg.slice(svg.indexOf(">") + 1);
    svg = svg.replace("</svg>", "");
  }
  return svg;
}

export function readSvg(name: string, folder: string) {
  //folder is usually svgItems but could also be svgItems/subfolder
  return stripSvg(fs.readFileSync(`./svgs/${folder}/${name}.svg`, "utf8"));
}

export function wearable(name: string, folder: string) {
  const svg = readSvg(name, folder);
  return svg;
}

export interface BodyWearableOutput {
  wearable: string;
  sleeves: SleeveObject;
}

export function bodyWearable(name: string, folder: string): BodyWearableOutput {
  let baseSvg = readSvg(name, folder);
  // console.log(name, svg.length)
  const id = name.slice(0, name.indexOf("_"));
  const leftSleevesUp =
    '<g class="gotchi-sleeves gotchi-sleeves-left gotchi-sleeves-up">' +
    readSvg(`${name}LeftUp`, folder) +
    "</g>";
  const leftSleeves =
    '<g class="gotchi-sleeves gotchi-sleeves-left gotchi-sleeves-down">' +
    readSvg(`${name}Left`, folder) +
    "</g>";
  const rightSleevesUp =
    '<g class="gotchi-sleeves gotchi-sleeves-right gotchi-sleeves-up">' +
    readSvg(`${name}RightUp`, folder) +
    "</g>";
  const rightSleeves =
    '<g class="gotchi-sleeves gotchi-sleeves-right gotchi-sleeves-down">' +
    readSvg(`${name}Right`, folder) +
    "</g>";
  let sleevesSvg =
    "<g>" +
    leftSleevesUp +
    leftSleeves +
    rightSleevesUp +
    rightSleeves +
    "</g>";

  return { wearable: baseSvg, sleeves: { id: id, svg: sleevesSvg } };
}

export interface UpdateSvgPayload {
  svgType: BytesLike;
  ids: string[];
  sizes: number[];
}

export function updateSvgsPayload(
  svg: string,
  svgType: string,
  svgId: string,
  ethers: any
): UpdateSvgPayload {
  let svgLength = new TextEncoder().encode(svg).length;
  const payload = {
    svgType: ethers.utils.formatBytes32String(svgType),
    ids: [svgId],
    sizes: [svgLength],
  };

  return payload;
}

export function svgTypeToBytes(svgType: string, ethers: any): BytesLike {
  return ethers.utils.formatBytes32String(svgType);
}

export async function uploadSvgs(
  svgFacet: SvgFacet,
  svgs: string[],
  svgType: string,
  ethers: any
) {
  let svgItemsStart = 0;
  let svgItemsEnd = 0;
  while (true) {
    let itemsSize = 0;
    while (true) {
      if (svgItemsEnd === svgs.length) {
        break;
      }
      itemsSize += svgs[svgItemsEnd].length;
      if (itemsSize > 24576) {
        break;
      }
      svgItemsEnd++;
    }
    const { svg, svgTypesAndSizes } = setupSvg(
      svgType,
      svgs.slice(svgItemsStart, svgItemsEnd),
      ethers
    );

    //this might be incorrect
    // printSizeInfo(svgType, svgTypesAndSizes[0].sizes);

    let tx = await svgFacet.storeSvg(svg, svgTypesAndSizes, {
      gasPrice: gasPrice,
    });
    let receipt = await tx.wait();
    if (!receipt.status) {
      throw Error(`Error:: ${tx.hash}`);
    }
    // console.log("tx:", tx.hash);
    // console.log(svgItemsEnd, svg.length);
    if (svgItemsEnd === svgs.length) {
      break;
    }
    svgItemsStart = svgItemsEnd;
  }
}

export async function updateSvgs(
  svgs: string[],
  svgType: string,
  svgIds: number[],
  svgFacet: SvgFacet,
  ethers: any
) {
  for (let index = 0; index < svgIds.length; index++) {
    const svgId = svgIds[index];
    const svg = svgs[index];
    let svgLength = new TextEncoder().encode(svg).length;
    const array = [
      {
        svgType: svgTypeToBytes(svgType, ethers),
        ids: [svgId],
        sizes: [svgLength],
      },
    ];

    let tx = await svgFacet.updateSvg(svg, array, {
      gasPrice: gasPrice,
    });
    // console.log("tx hash:", tx.hash);
    let receipt = await tx.wait();
    if (!receipt.status) {
      throw Error(`Error:: ${tx.hash}`);
    }
  }
}

export async function uploadOrUpdateSvg(
  svg: string | number,
  svgType: string,
  svgId: number,
  svgFacet: SvgFacet,
  ethers: any
) {
  if (typeof svg === "number") svg = "";

  let exists = false;
  try {
    await svgFacet.getSvg(svgTypeToBytes(svgType, ethers), svgId);
    exists = true;
  } catch (error) {}

  if (exists) {
    await updateSvgs([svg], svgType, [svgId], svgFacet, ethers);
    console.log(`Svg ${svgType} #${svgId} exists, updating`);
  } else {
    console.log(`Svg ${svgType} #${svgId} does not exist, uploading`);
    await uploadSvgs(svgFacet, [svg], svgType, ethers);
  }
}

export async function updateSvgTaskFront(_itemIds: number[]) {
  let taskArray = [];

  for (let index = 0; index < _itemIds.length; index++) {
    const itemId = _itemIds[index];
    const sideArrays = [front[itemId]];

    let taskArgsFront: UpdateSvgsTaskArgs = {
      svgIds: [itemId].join(","),
      svgType: `wearables`,
      svgs: [sideArrays].join("***"),
    };
    taskArray.push(taskArgsFront);
  }
  return taskArray;
}

export async function updateSvgTaskForSideViews(_itemIds: number[]) {
  const sideViews = ["left", "right", "back"];
  let taskArray = [];

  for (let index = 0; index < _itemIds.length; index++) {
    const itemId = _itemIds[index];
    const sideArrays = [left[itemId], right[itemId], back[itemId]];

    for (let index = 0; index < sideViews.length; index++) {
      const side = sideViews[index];
      const sideArray = sideArrays[index];

      let taskArgsSides: UpdateSvgsTaskArgs = {
        svgIds: [itemId].join(","),
        svgType: `wearables-${side}`,
        svgs: [sideArray].join("***"),
      };
      taskArray.push(taskArgsSides);
    }
  }
  return taskArray;
}

export async function updateSvgTaskForSideSleeves(_itemIds: number[]) {
  const sideViews = ["left", "right", "back"];
  let taskArray = [];

  for (let index = 0; index < _itemIds.length; index++) {
    const itemId = _itemIds[index];
    const sideArrays = [
      leftSleeve[itemId],
      rightSleeve[itemId],
      backSleeve[itemId],
    ];

    for (let index = 0; index < sideViews.length; index++) {
      const side = sideViews[index];
      const sideArray = sideArrays[index];

      let taskArgsSides: UpdateSvgsTaskArgs = {
        svgIds: [itemId].join(","),
        svgType: `sleeves-${side}`,
        svgs: [sideArray].join("***"),
      };
      taskArray.push(taskArgsSides);
    }
  }
  return taskArray;
}

export async function uploadSvgTaskForBaadges(
  itemTypeInput: ItemTypeInputNew[],
  fileName: string
) {
  let taskArray = [];

  for (let index = 0; index < itemTypeInput.length; index++) {
    if (itemTypeInput[index].canBeTransferred) {
      let taskArgs: AddItemTypesTaskArgs = {
        itemManager: itemManager,
        diamondAddress: maticRealmDiamondAddress,
        itemFile: fileName,
        svgFile: itemTypeInput[index].name,
        svgIds: [itemTypeInput[index].svgId].join(","),
        uploadItemTypes: true,
        sendToItemManager: true,
      };
      taskArray.push(taskArgs);
    } else {
      console.log(itemTypeInput[index].name + " is NOT transferable");
    }
  }
  return taskArray;
}

export async function airdropTaskForBaadges(
  itemTypeInput: ItemTypeInputNew[],
  awardsArray: number[]
) {
  let taskArray = [];

  for (let index = 0; index < itemTypeInput.length; index++) {
    let taskArgs: AirdropBaadgeTaskArgs = {
      maxProcess: [itemTypeInput[index].maxQuantity].join(","),
      badgeIds: [itemTypeInput[index].svgId].join(","),
      awardsArray: [awardsArray].join("***"),
    };
    taskArray.push(taskArgs);
  }
  return taskArray;
}
