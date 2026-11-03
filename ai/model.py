import torch
from torch import nn

class TankBrain(nn.Module):
    def __init__(self):
        super().__init__()
        self.hidden1 = nn.Linear(6, 32)
        self.hidden2 = nn.Linear(32, 32)
        self.output = nn.Linear(32, 6)
        self.relu = nn.ReLU()

    def forward(self, observation):
        x = self.relu(self.hidden1(observation))
        x = self.relu(self.hidden2(x))
        return self.output(x)