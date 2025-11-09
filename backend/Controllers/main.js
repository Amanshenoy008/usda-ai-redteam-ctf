import dotenv from 'dotenv';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
//const challenges = require('../data/misinformation.json');
import { PrismaClient } from '../generated/prisma/index.js';

dotenv.config();

const prisma = new PrismaClient()

export const main = (req,res,next)=>{
    try{
        res.status(200).json({msg:'API works successfully'})
    }catch(error)
    {
      next(error)
    }
}


export const metadata = async( req,res,next)=>{

  try{
    
    const { levelIndex, challenge } = req?.body;                 
    if (!levelIndex){
      return res.status(400).json({message:"Please enter a valid level"})
    }
    //console.log(level)
    //const newlevel = id.toString()
    //const source = challenges?.challenges?.[level];  
    //if (!source){
    //  return res.status(500).json({message:'Invalid level'})
    //}

    const lvl = await prisma.level.findFirst({
      where: {
        index: Number(levelIndex),
        isActive: true,
        challenge: { slug: challenge, isActive: true },
      },
      select: {
        index: true,
        title: true,
        description: true,
        difficulty: true,
        challenge: {
          select: {
            title: true, // challenge title
            family: { select: { owaspTag: true } }, // OWASP category
          },
        },
      },
    });

    if (!lvl) throw new Error('Level not found');

  const data = {
  title: lvl.challenge.title,              // challenge title
  owaspCategory: lvl.challenge.family.owaspTag,
  level: lvl.index,
  description: lvl.description,
  difficulty: lvl.difficulty,
  };

    res.json(data)

  }catch(error){
    console.log(error)
    
    return next(error)
  }
}