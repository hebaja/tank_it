import torch
from model import TankBrain

brain = TankBrain()

observation = torch.tensor(
    [0.0, 0.0, 0.93, 1.0, 0.0, 0.0],
    dtype=torch.float32,
)

values = brain(observation)
print(values)
action = torch.argmax(values).item()
print("Ação escolhida:", action)